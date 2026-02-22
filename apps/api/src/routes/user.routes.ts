/**
 * User routes (GDPR compliance).
 *
 * GET    /users/me/data-export  — Export all user data (Art. 20)
 * DELETE /users/me              — Soft-delete account (Art. 17)
 *
 * All routes require authentication.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { getDatabase } from '../db/connection.js';
import { authenticate } from '../middleware/authenticate.js';
import * as userService from '../services/user.service.js';
import { writeAuditLog, extractClientIp, extractUserAgent } from '../services/audit.service.js';

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function userRoutes(app: FastifyInstance): Promise<void> {
    // All user routes require authentication
    app.addHook('preHandler', authenticate);

    // -------------------------------------------------------------------
    // GET /users/me/data-export — Export all user data
    // -------------------------------------------------------------------

    app.get(
        '/users/me/data-export',
        {
            config: {
                rateLimit: { max: 3, timeWindow: 3_600_000 }, // 3/hour
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const db = getDatabase();
            const data = await userService.exportUserData(db, request.userId);

            void writeAuditLog(db, {
                userId: request.userId,
                action: 'data_export',
                resourceType: 'user',
                resourceId: request.userId,
                ip: extractClientIp(request),
                userAgent: extractUserAgent(request),
            });

            return reply
                .status(200)
                .header('Content-Disposition', 'attachment; filename="renderflow-data-export.json"')
                .header('Content-Type', 'application/json')
                .send(data);
        },
    );

    // -------------------------------------------------------------------
    // DELETE /users/me — Soft-delete account (PII anonymisation)
    // -------------------------------------------------------------------

    app.delete(
        '/users/me',
        {
            config: {
                rateLimit: { max: 1, timeWindow: 86_400_000 }, // 1/day
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const db = getDatabase();

            void writeAuditLog(db, {
                userId: request.userId,
                action: 'account_delete',
                resourceType: 'user',
                resourceId: request.userId,
                ip: extractClientIp(request),
                userAgent: extractUserAgent(request),
            });

            await userService.softDeleteUser(db, request.userId);

            return reply.status(200).send({
                message: 'Account data has been anonymised. You will be logged out.',
            });
        },
    );
}
