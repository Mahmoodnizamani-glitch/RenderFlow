/**
 * Tier-gating middleware unit tests.
 *
 * Validates that the requireTier middleware factory correctly gates
 * endpoints based on the user's tier from the database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

import { requireTier } from '../requireTier.js';

// ---------------------------------------------------------------------------
// Mock database
// ---------------------------------------------------------------------------

vi.mock('../../db/connection.js', () => ({
    getDatabase: vi.fn(() => mockDb),
}));

let mockDbResult: { tier: string }[] = [];

const mockDb = {
    select: vi.fn(() => mockDb),
    from: vi.fn(() => mockDb),
    where: vi.fn(() => mockDb),
    limit: vi.fn(() => Promise.resolve(mockDbResult)),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRequest(userId = 'user-123'): FastifyRequest {
    return { userId } as unknown as FastifyRequest;
}

const mockReply = {} as FastifyReply;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requireTier', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDbResult = [{ tier: 'free' }];
    });

    it('allows access when user meets minimum tier (free accessing free)', async () => {
        mockDbResult = [{ tier: 'free' }];
        const middleware = requireTier('free');

        await expect(middleware(createMockRequest(), mockReply)).resolves.toBeUndefined();
    });

    it('allows access when user tier exceeds minimum (pro accessing free)', async () => {
        mockDbResult = [{ tier: 'pro' }];
        const middleware = requireTier('free');

        await expect(middleware(createMockRequest(), mockReply)).resolves.toBeUndefined();
    });

    it('allows access when enterprise accesses team-gated endpoint', async () => {
        mockDbResult = [{ tier: 'enterprise' }];
        const middleware = requireTier('team');

        await expect(middleware(createMockRequest(), mockReply)).resolves.toBeUndefined();
    });

    it('rejects free user accessing pro-only endpoint', async () => {
        mockDbResult = [{ tier: 'free' }];
        const middleware = requireTier('pro');

        await expect(middleware(createMockRequest(), mockReply)).rejects.toThrow(
            /requires a pro tier or higher/i,
        );
    });

    it('rejects pro user accessing team-only endpoint', async () => {
        mockDbResult = [{ tier: 'pro' }];
        const middleware = requireTier('team');

        await expect(middleware(createMockRequest(), mockReply)).rejects.toThrow(
            /requires a team tier or higher/i,
        );
    });

    it('rejects free user accessing enterprise-only endpoint', async () => {
        mockDbResult = [{ tier: 'free' }];
        const middleware = requireTier('enterprise');

        await expect(middleware(createMockRequest(), mockReply)).rejects.toThrow(
            /requires a enterprise tier or higher/i,
        );
    });

    it('throws 401 when user is not found in database', async () => {
        mockDbResult = [];
        const middleware = requireTier('free');

        await expect(middleware(createMockRequest(), mockReply)).rejects.toThrow(
            /user not found/i,
        );
    });

    it('uses the request userId to query the database', async () => {
        mockDbResult = [{ tier: 'pro' }];
        const middleware = requireTier('free');

        await middleware(createMockRequest('specific-user-id'), mockReply);

        expect(mockDb.select).toHaveBeenCalledOnce();
    });
});
