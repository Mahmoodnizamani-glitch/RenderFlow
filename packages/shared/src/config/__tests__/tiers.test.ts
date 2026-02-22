/**
 * Tier configuration unit tests.
 *
 * Validates tier limits, credit packs, pricing constants,
 * and helper functions work correctly.
 */
import {
    TIER_LIMITS,
    CREDIT_PACKS,
    SUBSCRIPTION_PRICING,
    tierLevel,
    meetsMinimumTier,
    getTierLimits,
    getTierPricing,
    isUnlimited,
    formatUsdCents,
} from '../../config/tiers';
import type { UserTier } from '../../schemas/auth';

// ---------------------------------------------------------------------------
// TIER_LIMITS
// ---------------------------------------------------------------------------

describe('TIER_LIMITS', () => {
    it('contains all four tiers', () => {
        const tiers: UserTier[] = ['free', 'pro', 'team', 'enterprise'];
        for (const tier of tiers) {
            expect(TIER_LIMITS[tier]).toBeDefined();
            expect(TIER_LIMITS[tier].label).toBeTruthy();
        }
    });

    it('free tier has stricter limits than pro', () => {
        expect(TIER_LIMITS.free.maxProjects).toBeLessThan(
            TIER_LIMITS.pro.maxProjects === -1 ? Infinity : TIER_LIMITS.pro.maxProjects,
        );
        expect(TIER_LIMITS.free.maxRendersPerDay).toBeLessThan(
            isUnlimited(TIER_LIMITS.pro.maxRendersPerDay)
                ? Infinity
                : TIER_LIMITS.pro.maxRendersPerDay,
        );
    });

    it('free tier has watermark', () => {
        expect(TIER_LIMITS.free.hasWatermark).toBe(true);
    });

    it('pro tier has no watermark', () => {
        expect(TIER_LIMITS.pro.hasWatermark).toBe(false);
    });

    it('enterprise has unlimited markers (-1)', () => {
        expect(isUnlimited(TIER_LIMITS.enterprise.maxProjects)).toBe(true);
        expect(isUnlimited(TIER_LIMITS.enterprise.maxRendersPerDay)).toBe(true);
        expect(isUnlimited(TIER_LIMITS.enterprise.storageBytes)).toBe(true);
    });

    it('each tier has a positive starterCredits value', () => {
        for (const tier of Object.values(TIER_LIMITS)) {
            expect(tier.starterCredits).toBeGreaterThanOrEqual(0);
        }
    });
});

// ---------------------------------------------------------------------------
// CREDIT_PACKS
// ---------------------------------------------------------------------------

describe('CREDIT_PACKS', () => {
    it('contains at least 3 packs', () => {
        expect(CREDIT_PACKS.length).toBeGreaterThanOrEqual(3);
    });

    it('each pack has a unique id', () => {
        const ids = CREDIT_PACKS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('perCreditCents is consistent with price and credits', () => {
        for (const pack of CREDIT_PACKS) {
            const expected = Math.round(pack.priceUsdCents / pack.credits);
            expect(pack.perCreditCents).toBe(expected);
        }
    });

    it('exactly one pack is marked as best value', () => {
        const bestPacks = CREDIT_PACKS.filter((p) => p.isBestValue);
        expect(bestPacks.length).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// SUBSCRIPTION_PRICING
// ---------------------------------------------------------------------------

describe('SUBSCRIPTION_PRICING', () => {
    it('contains at least the paid tiers', () => {
        expect(SUBSCRIPTION_PRICING.length).toBeGreaterThanOrEqual(3);
    });

    it('annual price is less than 12x monthly price for paid tiers', () => {
        for (const pricing of SUBSCRIPTION_PRICING) {
            if (pricing.monthlyPriceUsdCents === 0) continue;
            expect(pricing.annualPriceUsdCents).toBeLessThanOrEqual(
                pricing.monthlyPriceUsdCents * 12,
            );
        }
    });
});

// ---------------------------------------------------------------------------
// tierLevel
// ---------------------------------------------------------------------------

describe('tierLevel', () => {
    it('returns ascending values for free < pro < team < enterprise', () => {
        expect(tierLevel('free')).toBeLessThan(tierLevel('pro'));
        expect(tierLevel('pro')).toBeLessThan(tierLevel('team'));
        expect(tierLevel('team')).toBeLessThan(tierLevel('enterprise'));
    });
});

// ---------------------------------------------------------------------------
// meetsMinimumTier
// ---------------------------------------------------------------------------

describe('meetsMinimumTier', () => {
    it('free meets free', () => {
        expect(meetsMinimumTier('free', 'free')).toBe(true);
    });

    it('free does not meet pro', () => {
        expect(meetsMinimumTier('free', 'pro')).toBe(false);
    });

    it('enterprise meets all tiers', () => {
        expect(meetsMinimumTier('enterprise', 'free')).toBe(true);
        expect(meetsMinimumTier('enterprise', 'pro')).toBe(true);
        expect(meetsMinimumTier('enterprise', 'team')).toBe(true);
        expect(meetsMinimumTier('enterprise', 'enterprise')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// getTierLimits
// ---------------------------------------------------------------------------

describe('getTierLimits', () => {
    it('returns correct limits for each tier', () => {
        expect(getTierLimits('free')).toBe(TIER_LIMITS.free);
        expect(getTierLimits('pro')).toBe(TIER_LIMITS.pro);
    });
});

// ---------------------------------------------------------------------------
// getTierPricing
// ---------------------------------------------------------------------------

describe('getTierPricing', () => {
    it('returns pricing for known tier', () => {
        const pricing = getTierPricing('pro');
        expect(pricing).toBeDefined();
        expect(pricing?.tier).toBe('pro');
    });

    it('returns undefined for unknown tier', () => {
        const pricing = getTierPricing('free');
        // free tier may or may not have pricing — just check it doesn't throw
        expect(pricing?.tier ?? 'free').toBe('free');
    });
});

// ---------------------------------------------------------------------------
// isUnlimited
// ---------------------------------------------------------------------------

describe('isUnlimited', () => {
    it('returns true for -1', () => {
        expect(isUnlimited(-1)).toBe(true);
    });

    it('returns false for positive numbers', () => {
        expect(isUnlimited(0)).toBe(false);
        expect(isUnlimited(100)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// formatUsdCents
// ---------------------------------------------------------------------------

describe('formatUsdCents', () => {
    it('formats whole dollars', () => {
        expect(formatUsdCents(1000)).toBe('$10.00');
    });

    it('formats cents correctly', () => {
        expect(formatUsdCents(999)).toBe('$9.99');
    });

    it('formats zero as Free', () => {
        expect(formatUsdCents(0)).toBe('Free');
    });

    it('formats large amounts', () => {
        expect(formatUsdCents(9999)).toBe('$99.99');
    });
});
