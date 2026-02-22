/**
 * Socket.io JWT authentication middleware.
 *
 * Verifies JWT from the handshake auth object or authorization header.
 * Attaches userId to socket.data on success. Rejects connection on failure.
 *
 * Uses `jsonwebtoken` directly instead of `@fastify/jwt` because Socket.io
 * connections do not flow through Fastify's request lifecycle.
 */
import jwt from 'jsonwebtoken';
import type { Socket } from 'socket.io';

import type {
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData,
} from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthSocket = Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>;

interface JwtPayload {
    sub: string;
    iat?: number;
    exp?: number;
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * Create a Socket.io authentication middleware.
 *
 * Extracts the JWT from `socket.handshake.auth.token` (preferred)
 * or the `Authorization: Bearer <token>` header (fallback).
 */
export function createAuthMiddleware(jwtSecret: string) {
    return (socket: AuthSocket, next: (err?: Error) => void): void => {
        const token = extractToken(socket);

        if (!token) {
            next(new Error('Authentication required'));
            return;
        }

        try {
            const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

            if (!decoded.sub) {
                next(new Error('Invalid token payload'));
                return;
            }

            socket.data.userId = decoded.sub;
            next();
        } catch (err: unknown) {
            if (err instanceof jwt.TokenExpiredError) {
                next(new Error('Token expired'));
                return;
            }
            if (err instanceof jwt.JsonWebTokenError) {
                next(new Error('Invalid token'));
                return;
            }
            next(new Error('Authentication failed'));
        }
    };
}

// ---------------------------------------------------------------------------
// Token extraction
// ---------------------------------------------------------------------------

/**
 * Extract JWT from the socket handshake.
 * Priority: auth.token > Authorization header
 */
function extractToken(socket: AuthSocket): string | null {
    // 1. Check auth object (preferred for Socket.io clients)
    const authToken = socket.handshake.auth?.['token'];
    if (typeof authToken === 'string' && authToken.length > 0) {
        return authToken;
    }

    // 2. Check Authorization header (fallback for HTTP-based transports)
    const authHeader = socket.handshake.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }

    return null;
}
