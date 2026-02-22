/**
 * Authentication middleware.
 *
 * Extracts and verifies JWT from the Authorization: Bearer header.
 * Attaches `request.userId` on success.
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../errors/errors.js';

// ---------------------------------------------------------------------------
// Fastify type augmentation
// ---------------------------------------------------------------------------

declare module 'fastify' {
    interface FastifyRequest {
        userId: string;
    }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Fastify `preHandler` hook that requires a valid JWT access token.
 *
 * Usage:
 *   app.get('/protected', { preHandler: [authenticate] }, handler)
 */
export async function authenticate(
    request: FastifyRequest,
    _reply: FastifyReply,
): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        throw AppError.unauthorized('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);

    if (!token) {
        throw AppError.unauthorized('Missing access token');
    }

    try {
        const decoded = request.server.jwt.verify<{ sub: string }>(token);

        if (!decoded.sub) {
            throw AppError.unauthorized('Invalid token payload');
        }

        request.userId = decoded.sub;
    } catch (err: unknown) {
        if (AppError.is(err)) throw err;

        // JWT verification errors (expired, malformed, etc.)
        const message =
            err instanceof Error && err.message.includes('expired')
                ? 'Access token has expired'
                : 'Invalid access token';

        throw AppError.unauthorized(message);
    }
}
