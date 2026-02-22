/**
 * Authentication middleware unit tests.
 *
 * Validates JWT extraction from Authorization header, verification,
 * and appropriate error responses for missing/invalid/expired tokens.
 */
import { describe, it, expect, vi } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

import { authenticate } from '../authenticate.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockRequest(
    authHeader?: string,
    jwtResult?: { sub: string } | Error,
): FastifyRequest {
    const jwt = {
        verify: vi.fn(() => {
            if (jwtResult instanceof Error) throw jwtResult;
            return jwtResult ?? { sub: 'user-123' };
        }),
    };

    return {
        headers: {
            authorization: authHeader,
        },
        server: { jwt },
        userId: '',
    } as unknown as FastifyRequest;
}

const mockReply = {} as FastifyReply;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('authenticate middleware', () => {
    it('sets userId from valid JWT', async () => {
        const req = createMockRequest('Bearer valid-token', { sub: 'user-abc' });

        await authenticate(req, mockReply);

        expect(req.userId).toBe('user-abc');
        expect(req.server.jwt.verify).toHaveBeenCalledWith('valid-token');
    });

    it('throws 401 when authorization header is missing', async () => {
        const req = createMockRequest(undefined);

        await expect(authenticate(req, mockReply)).rejects.toThrow(
            /missing or invalid authorization header/i,
        );
    });

    it('throws 401 when authorization header lacks Bearer prefix', async () => {
        const req = createMockRequest('Basic some-token');

        await expect(authenticate(req, mockReply)).rejects.toThrow(
            /missing or invalid authorization header/i,
        );
    });

    it('throws 401 when token is empty string after Bearer', async () => {
        const req = createMockRequest('Bearer ');

        await expect(authenticate(req, mockReply)).rejects.toThrow(
            /missing access token/i,
        );
    });

    it('throws 401 when JWT is expired', async () => {
        const expiredError = new Error('jwt expired');
        const req = createMockRequest('Bearer expired-token', expiredError);

        await expect(authenticate(req, mockReply)).rejects.toThrow(
            /expired/i,
        );
    });

    it('throws 401 when JWT is malformed', async () => {
        const malformedError = new Error('jwt malformed');
        const req = createMockRequest('Bearer bad-token', malformedError);

        await expect(authenticate(req, mockReply)).rejects.toThrow(
            /invalid access token/i,
        );
    });

    it('throws 401 when JWT payload has no sub claim', async () => {
        const req = createMockRequest(
            'Bearer valid-token',
            { sub: '' } as { sub: string },
        );

        await expect(authenticate(req, mockReply)).rejects.toThrow(
            /invalid token payload/i,
        );
    });
});
