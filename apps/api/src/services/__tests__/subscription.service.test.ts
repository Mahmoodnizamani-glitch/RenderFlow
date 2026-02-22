/**
 * Subscription service unit tests.
 *
 * Tests subscription lifecycle: creation, status updates, cancellation,
 * monthly credit grants, tier sync, and usage summary with mocked database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserTier } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Mock database
// ---------------------------------------------------------------------------

interface MockSubscriptionRow {
    id: string;
    userId: string;
    tier: string;
    status: string;
    provider: string;
    providerSubscriptionId: string | null;
    providerCustomerId: string | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    trialEnd: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

function createMockSubRow(overrides?: Partial<MockSubscriptionRow>): MockSubscriptionRow {
    return {
        id: 'sub-001',
        userId: 'user-123',
        tier: 'pro',
        status: 'active',
        provider: 'revenuecat',
        providerSubscriptionId: 'rc-sub-001',
        providerCustomerId: 'rc-cust-001',
        currentPeriodStart: new Date('2026-01-01T00:00:00Z'),
        currentPeriodEnd: new Date('2026-02-01T00:00:00Z'),
        cancelAtPeriodEnd: false,
        trialEnd: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-15T00:00:00Z'),
        ...overrides,
    };
}

let mockInsertResult: MockSubscriptionRow[] = [];
let mockSelectResult: MockSubscriptionRow[] = [];
let _mockUpdateResult: MockSubscriptionRow[] = [];
let _mockUserResult: Array<{ tier: string; renderCredits: number }> = [];

const mockDb = {
    insert: vi.fn(() => mockDb),
    values: vi.fn(() => mockDb),
    returning: vi.fn(() => Promise.resolve(mockInsertResult)),
    select: vi.fn((..._args: unknown[]) => mockDb),
    from: vi.fn(() => mockDb),
    where: vi.fn(() => mockDb),
    limit: vi.fn(() => Promise.resolve(mockSelectResult)),
    orderBy: vi.fn(() => mockDb),
    update: vi.fn(() => mockDb),
    set: vi.fn(() => mockDb),
    delete: vi.fn(() => mockDb),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('subscription service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockInsertResult = [createMockSubRow()];
        mockSelectResult = [createMockSubRow()];
        _mockUpdateResult = [createMockSubRow()];
        _mockUserResult = [{ tier: 'free', renderCredits: 5 }];
    });

    describe('createSubscription', () => {
        it('inserts a subscription record', async () => {
            const { createSubscription } = await import('../subscription.service.js');

            const result = await createSubscription(mockDb as never, {
                userId: 'user-123',
                tier: 'pro' as UserTier,
                status: 'active' as never,
                provider: 'revenuecat' as never,
                providerSubscriptionId: 'rc-sub-001',
            });

            expect(mockDb.insert).toHaveBeenCalled();
            expect(result.id).toBe('sub-001');
            expect(result.tier).toBe('pro');
        });
    });

    describe('getActiveSubscription', () => {
        it('returns the active subscription for a user', async () => {
            const { getActiveSubscription } = await import('../subscription.service.js');

            const result = await getActiveSubscription(mockDb as never, 'user-123');

            expect(result).not.toBeNull();
            expect(result?.status).toBe('active');
        });

        it('returns null when no active subscription', async () => {
            mockSelectResult = [];
            mockDb.limit.mockResolvedValueOnce([]);

            const { getActiveSubscription } = await import('../subscription.service.js');

            const result = await getActiveSubscription(mockDb as never, 'user-123');

            expect(result).toBeNull();
        });
    });

    describe('getByProviderId', () => {
        it('returns subscription by provider subscription ID', async () => {
            const { getByProviderId } = await import('../subscription.service.js');

            const result = await getByProviderId(mockDb as never, 'rc-sub-001');

            expect(result?.providerSubscriptionId).toBe('rc-sub-001');
        });

        it('returns null when provider ID not found', async () => {
            mockDb.limit.mockResolvedValueOnce([]);

            const { getByProviderId } = await import('../subscription.service.js');

            const result = await getByProviderId(mockDb as never, 'nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('updateSubscriptionStatus', () => {
        it('updates the status and returns updated row', async () => {
            const updatedRow = createMockSubRow({ status: 'cancelled' });
            mockDb.returning.mockResolvedValueOnce([updatedRow]);

            const { updateSubscriptionStatus } = await import('../subscription.service.js');

            const result = await updateSubscriptionStatus(
                mockDb as never,
                'sub-001',
                'cancelled' as never,
            );

            expect(mockDb.update).toHaveBeenCalled();
            expect(result.status).toBe('cancelled');
        });

        it('throws not found when subscription does not exist', async () => {
            mockDb.returning.mockResolvedValueOnce([]);

            const { updateSubscriptionStatus } = await import('../subscription.service.js');

            await expect(
                updateSubscriptionStatus(mockDb as never, 'nonexistent', 'cancelled' as never),
            ).rejects.toThrow(/not found/i);
        });
    });

    describe('cancelSubscription', () => {
        it('marks subscription to cancel at period end', async () => {
            const cancelled = createMockSubRow({ cancelAtPeriodEnd: true });
            mockDb.returning.mockResolvedValueOnce([cancelled]);

            const { cancelSubscription } = await import('../subscription.service.js');

            const result = await cancelSubscription(mockDb as never, 'sub-001');

            expect(result.cancelAtPeriodEnd).toBe(true);
        });
    });

    describe('grantMonthlyCredits', () => {
        it('grants credits for the given tier', async () => {
            // Mock the user lookup and update
            mockDb.limit.mockResolvedValueOnce([{ renderCredits: 5 }] as never);
            mockDb.returning.mockResolvedValueOnce([{ renderCredits: 105 }] as never);

            const { grantMonthlyCredits } = await import('../subscription.service.js');

            const newBalance = await grantMonthlyCredits(mockDb as never, 'user-123', 'pro');

            expect(typeof newBalance).toBe('number');
        });
    });

});
