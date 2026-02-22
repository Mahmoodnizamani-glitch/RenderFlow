/**
 * Credit service unit tests.
 *
 * Tests credit calculation, atomic deduction, refunds,
 * balance queries, and daily render count.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockReturning = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockLimit = vi.fn();

function createMockDb() {
    // Chain: db.update(table).set(data).where(cond).returning()
    mockReturning.mockResolvedValue([]);
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    // Chain: db.select(cols).from(table).where(cond).limit(n)
    mockLimit.mockResolvedValue([]);
    mockWhere.mockReturnValue({ returning: mockReturning, limit: mockLimit });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    return {
        update: mockUpdate,
        select: mockSelect,
    } as any;
}

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

const { calculateCost, deductCredits, refundCredits, getBalance, getDailyRenderCount } =
    await import('../credit.service.js');

const { AppError: _AppError } = await import('../../errors/errors.js');

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// calculateCost
// ---------------------------------------------------------------------------

describe('calculateCost', () => {
    it('returns 1 credit for a short 1080p MP4 render', () => {
        const cost = calculateCost({
            width: 1920,
            height: 1080,
            fps: 30,
            durationInFrames: 900, // 30 seconds
            format: 'mp4',
        });
        // ceil(900/30/60) = ceil(0.5) = 1 minute, × 1 (1080p) × 1 (mp4) = 1
        expect(cost).toBe(1);
    });

    it('scales with duration', () => {
        const cost = calculateCost({
            width: 1920,
            height: 1080,
            fps: 30,
            durationInFrames: 5400, // 3 minutes
            format: 'mp4',
        });
        // ceil(5400/30/60) = ceil(3) = 3 × 1 × 1 = 3
        expect(cost).toBe(3);
    });

    it('applies 2x multiplier for 4K', () => {
        const cost = calculateCost({
            width: 3840,
            height: 2160,
            fps: 30,
            durationInFrames: 1800, // 1 minute
            format: 'mp4',
        });
        // ceil(1800/30/60) = 1 × 2 (4K) × 1 (mp4) = 2
        expect(cost).toBe(2);
    });

    it('applies 1.5x multiplier for 1440p', () => {
        const cost = calculateCost({
            width: 2560,
            height: 1440,
            fps: 30,
            durationInFrames: 3600, // 2 minutes
            format: 'mp4',
        });
        // ceil(3600/30/60) = 2 × 1.5 (1440p) × 1 (mp4) = 3
        expect(cost).toBe(3);
    });

    it('applies 0.5x multiplier for GIF', () => {
        const cost = calculateCost({
            width: 1920,
            height: 1080,
            fps: 30,
            durationInFrames: 3600, // 2 minutes
            format: 'gif',
        });
        // ceil(3600/30/60) = 2 × 1 (1080p) × 0.5 (gif) = 1
        expect(cost).toBe(1);
    });

    it('returns minimum 1 credit for very short renders', () => {
        const cost = calculateCost({
            width: 1920,
            height: 1080,
            fps: 60,
            durationInFrames: 1,
            format: 'gif',
        });
        expect(cost).toBe(1);
    });

    it('returns 1 for zero or negative duration', () => {
        expect(calculateCost({ width: 1920, height: 1080, fps: 30, durationInFrames: 0 })).toBe(1);
        expect(calculateCost({ width: 1920, height: 1080, fps: 30, durationInFrames: -5 })).toBe(1);
    });

    it('handles missing format (defaults to 1x)', () => {
        const cost = calculateCost({
            width: 1920,
            height: 1080,
            fps: 30,
            durationInFrames: 1800,
        });
        expect(cost).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// deductCredits
// ---------------------------------------------------------------------------

describe('deductCredits', () => {
    it('deducts credits and returns new balance', async () => {
        const db = createMockDb();
        mockReturning.mockResolvedValue([{ renderCredits: 7 }]);

        const newBalance = await deductCredits(db, 'user-123', 3);
        expect(newBalance).toBe(7);
        expect(mockUpdate).toHaveBeenCalled();
    });

    it('throws paymentRequired when insufficient credits', async () => {
        const db = createMockDb();
        // UPDATE returns 0 rows (balance check failed)
        mockReturning.mockResolvedValue([]);
        // SELECT returns user with low balance
        mockLimit.mockResolvedValue([{ renderCredits: 2 }]);

        await expect(deductCredits(db, 'user-123', 5)).rejects.toThrow(
            expect.objectContaining({
                code: 'PAYMENT_REQUIRED',
            }),
        );
    });

    it('throws notFound when user does not exist', async () => {
        const db = createMockDb();
        mockReturning.mockResolvedValue([]);
        mockLimit.mockResolvedValue([]);

        await expect(deductCredits(db, 'nonexistent', 1)).rejects.toThrow(
            expect.objectContaining({
                code: 'NOT_FOUND',
            }),
        );
    });

    it('rejects non-positive amounts', async () => {
        const db = createMockDb();

        await expect(deductCredits(db, 'user-123', 0)).rejects.toThrow(
            expect.objectContaining({
                code: 'VALIDATION_ERROR',
            }),
        );

        await expect(deductCredits(db, 'user-123', -1)).rejects.toThrow(
            expect.objectContaining({
                code: 'VALIDATION_ERROR',
            }),
        );
    });
});

// ---------------------------------------------------------------------------
// refundCredits
// ---------------------------------------------------------------------------

describe('refundCredits', () => {
    it('adds credits back and returns new balance', async () => {
        const db = createMockDb();
        mockReturning.mockResolvedValue([{ renderCredits: 15 }]);

        const newBalance = await refundCredits(db, 'user-123', 5, 'Job failed');
        expect(newBalance).toBe(15);
    });

    it('throws notFound when user does not exist', async () => {
        const db = createMockDb();
        mockReturning.mockResolvedValue([]);

        await expect(refundCredits(db, 'nonexistent', 1, 'refund')).rejects.toThrow(
            expect.objectContaining({
                code: 'NOT_FOUND',
            }),
        );
    });

    it('rejects non-positive amounts', async () => {
        const db = createMockDb();

        await expect(refundCredits(db, 'user-123', 0, 'test')).rejects.toThrow(
            expect.objectContaining({
                code: 'VALIDATION_ERROR',
            }),
        );
    });
});

// ---------------------------------------------------------------------------
// getBalance
// ---------------------------------------------------------------------------

describe('getBalance', () => {
    it('returns current credit balance', async () => {
        const db = createMockDb();
        mockLimit.mockResolvedValue([{ renderCredits: 42 }]);

        const balance = await getBalance(db, 'user-123');
        expect(balance).toBe(42);
    });

    it('throws notFound when user does not exist', async () => {
        const db = createMockDb();
        mockLimit.mockResolvedValue([]);

        await expect(getBalance(db, 'nonexistent')).rejects.toThrow(
            expect.objectContaining({
                code: 'NOT_FOUND',
            }),
        );
    });
});

// ---------------------------------------------------------------------------
// getDailyRenderCount
// ---------------------------------------------------------------------------

describe('getDailyRenderCount', () => {
    it('returns count of renders created today', async () => {
        const db = createMockDb();
        mockWhere.mockReturnValue([{ count: 2 }]);

        const dailyCount = await getDailyRenderCount(db, 'user-123');
        expect(dailyCount).toBe(2);
    });

    it('returns 0 when no renders today', async () => {
        const db = createMockDb();
        mockWhere.mockReturnValue([{ count: 0 }]);

        const dailyCount = await getDailyRenderCount(db, 'user-123');
        expect(dailyCount).toBe(0);
    });
});
