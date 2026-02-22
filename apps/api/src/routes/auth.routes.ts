/**
 * Authentication routes.
 *
 * POST /auth/register       — Create account + return tokens
 * POST /auth/login          — Authenticate + return tokens
 * POST /auth/refresh        — Rotate refresh token + return new pair
 * POST /auth/logout         — Invalidate refresh token
 * POST /auth/change-password — Change password + invalidate all tokens
 * GET  /auth/me             — Return current user profile
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import {
    RegisterInputSchema,
    LoginInputSchema,
    RefreshTokenInputSchema,
    ChangePasswordInputSchema,
} from '@renderflow/shared';
import { getDatabase } from '../db/connection.js';
import { authenticate } from '../middleware/authenticate.js';
import * as authService from '../services/auth.service.js';
import { writeAuditLog, extractClientIp, extractUserAgent } from '../services/audit.service.js';

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function authRoutes(app: FastifyInstance): Promise<void> {
    // -----------------------------------------------------------------------
    // POST /auth/register
    // -----------------------------------------------------------------------

    app.post(
        '/auth/register',
        {
            config: {
                rateLimit: { max: 10, timeWindow: 60_000 },
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const body = RegisterInputSchema.parse(request.body);
            const db = getDatabase();

            const { user, tokens } = await authService.register(
                db,
                body.email,
                body.password,
                body.displayName,
                app.jwt,
            );

            void writeAuditLog(db, {
                userId: user.id,
                action: 'register',
                resourceType: 'user',
                resourceId: user.id,
                ip: extractClientIp(request),
                userAgent: extractUserAgent(request),
            });

            return reply.status(201).send({
                user,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            });
        },
    );

    // -----------------------------------------------------------------------
    // POST /auth/login
    // -----------------------------------------------------------------------

    app.post(
        '/auth/login',
        {
            config: {
                rateLimit: { max: 10, timeWindow: 60_000 },
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const body = LoginInputSchema.parse(request.body);
            const db = getDatabase();

            const { user, tokens } = await authService.login(
                db,
                body.email,
                body.password,
                app.jwt,
            );

            void writeAuditLog(db, {
                userId: user.id,
                action: 'login',
                resourceType: 'user',
                resourceId: user.id,
                ip: extractClientIp(request),
                userAgent: extractUserAgent(request),
            });

            return reply.status(200).send({
                user,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            });
        },
    );

    // -----------------------------------------------------------------------
    // POST /auth/refresh
    // -----------------------------------------------------------------------

    app.post(
        '/auth/refresh',
        {
            config: {
                rateLimit: { max: 30, timeWindow: 60_000 },
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const body = RefreshTokenInputSchema.parse(request.body);
            const db = getDatabase();

            const { user, tokens } = await authService.refreshAccessToken(
                db,
                body.refreshToken,
                app.jwt,
            );

            return reply.status(200).send({
                user,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            });
        },
    );

    // -----------------------------------------------------------------------
    // POST /auth/logout
    // -----------------------------------------------------------------------

    app.post(
        '/auth/logout',
        { preHandler: [authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const body = RefreshTokenInputSchema.parse(request.body);
            const db = getDatabase();

            await authService.logout(db, body.refreshToken);

            void writeAuditLog(db, {
                userId: request.userId,
                action: 'logout',
                resourceType: 'user',
                resourceId: request.userId,
                ip: extractClientIp(request),
                userAgent: extractUserAgent(request),
            });

            return reply.status(200).send({ message: 'Logged out successfully' });
        },
    );

    // -----------------------------------------------------------------------
    // POST /auth/change-password
    // -----------------------------------------------------------------------

    app.post(
        '/auth/change-password',
        {
            preHandler: [authenticate],
            config: {
                rateLimit: { max: 10, timeWindow: 60_000 },
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const body = ChangePasswordInputSchema.parse(request.body);
            const db = getDatabase();

            await authService.changePassword(
                db,
                request.userId,
                body.oldPassword,
                body.newPassword,
            );

            void writeAuditLog(db, {
                userId: request.userId,
                action: 'password_change',
                resourceType: 'user',
                resourceId: request.userId,
                ip: extractClientIp(request),
                userAgent: extractUserAgent(request),
            });

            return reply.status(200).send({
                message: 'Password changed successfully',
            });
        },
    );

    // -----------------------------------------------------------------------
    // GET /auth/me
    // -----------------------------------------------------------------------

    app.get(
        '/auth/me',
        { preHandler: [authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const db = getDatabase();
            const user = await authService.getUserProfile(db, request.userId);

            return reply.status(200).send({ user });
        },
    );
}
