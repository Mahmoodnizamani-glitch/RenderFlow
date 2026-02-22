/**
 * Tier configuration.
 *
 * Centralised limits, quotas, and feature flags for each subscription
 * tier. Consumed by both the API (enforcement) and mobile (UI display).
 */
import type { UserTier } from '../schemas/auth';

// ---------------------------------------------------------------------------
// Tier feature flags
// ---------------------------------------------------------------------------

export interface TierLimits {
    /** Display label for UI. */
    readonly label: string;
    /** Maximum projects a user can create. -1 = unlimited. */
    readonly maxProjects: number;
    /** Maximum cloud renders per day. -1 = unlimited. */
    readonly maxRendersPerDay: number;
    /** Maximum render height in pixels (e.g. 720, 1080, 2160). */
    readonly maxResolutionHeight: number;
    /** Whether rendered output carries a watermark. */
    readonly hasWatermark: boolean;
    /** Storage quota in bytes. */
    readonly storageBytes: number;
    /** Credits granted on subscription renewal each month. */
    readonly monthlyCredits: number;
    /** Credits given to new users on registration. */
    readonly starterCredits: number;
    /** Maximum team seats. 1 = individual. */
    readonly maxSeats: number;
    /** Features available on this tier. */
    readonly features: readonly TierFeature[];
}

export type TierFeature =
    | 'api_access'
    | 'white_label'
    | 'shared_projects'
    | 'priority_support'
    | 'custom_branding'
    | 'priority_render';

// ---------------------------------------------------------------------------
// Tier definitions
// ---------------------------------------------------------------------------

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

export const TIER_LIMITS: Readonly<Record<UserTier, TierLimits>> = {
    free: {
        label: 'Free',
        maxProjects: 3,
        maxRendersPerDay: 3,
        maxResolutionHeight: 720,
        hasWatermark: true,
        storageBytes: 500 * MB,
        monthlyCredits: 0,
        starterCredits: 5,
        maxSeats: 1,
        features: [],
    },
    pro: {
        label: 'Pro',
        maxProjects: -1,
        maxRendersPerDay: -1,
        maxResolutionHeight: 2160,
        hasWatermark: false,
        storageBytes: 5 * GB,
        monthlyCredits: 50,
        starterCredits: 50,
        maxSeats: 1,
        features: ['priority_render'],
    },
    team: {
        label: 'Team',
        maxProjects: -1,
        maxRendersPerDay: -1,
        maxResolutionHeight: 2160,
        hasWatermark: false,
        storageBytes: 20 * GB,
        monthlyCredits: 200,
        starterCredits: 200,
        maxSeats: 5,
        features: ['priority_render', 'shared_projects', 'priority_support'],
    },
    enterprise: {
        label: 'Enterprise',
        maxProjects: -1,
        maxRendersPerDay: -1,
        maxResolutionHeight: 2160,
        hasWatermark: false,
        storageBytes: -1, // unlimited
        monthlyCredits: -1, // unlimited
        starterCredits: 1000,
        maxSeats: -1, // unlimited
        features: [
            'priority_render',
            'shared_projects',
            'priority_support',
            'api_access',
            'white_label',
            'custom_branding',
        ],
    },
} as const;

// ---------------------------------------------------------------------------
// Credit packs (one-time purchase)
// ---------------------------------------------------------------------------

export interface CreditPack {
    /** Unique identifier for RevenueCat/Stripe product. */
    readonly id: string;
    /** Number of credits in the pack. */
    readonly credits: number;
    /** Price in USD cents. */
    readonly priceUsdCents: number;
    /** Human-readable label. */
    readonly label: string;
    /** Per-credit price for comparison display (USD cents). */
    readonly perCreditCents: number;
    /** Whether this pack shows a "Best Value" badge. */
    readonly isBestValue: boolean;
}

export const CREDIT_PACKS: readonly CreditPack[] = [
    {
        id: 'credits_10',
        credits: 10,
        priceUsdCents: 499,
        label: '10 Credits',
        perCreditCents: 50,
        isBestValue: false,
    },
    {
        id: 'credits_50',
        credits: 50,
        priceUsdCents: 1999,
        label: '50 Credits',
        perCreditCents: 40,
        isBestValue: false,
    },
    {
        id: 'credits_200',
        credits: 200,
        priceUsdCents: 5999,
        label: '200 Credits',
        perCreditCents: 30,
        isBestValue: true,
    },
    {
        id: 'credits_1000',
        credits: 1000,
        priceUsdCents: 19999,
        label: '1,000 Credits',
        perCreditCents: 20,
        isBestValue: false,
    },
] as const;

// ---------------------------------------------------------------------------
// Subscription pricing (for UI display only — store prices are source of truth)
// ---------------------------------------------------------------------------

export interface SubscriptionPricing {
    readonly tier: UserTier;
    /** Monthly price in USD cents. 0 = free. */
    readonly monthlyPriceUsdCents: number;
    /** Annual price in USD cents (2 months free). 0 = free. */
    readonly annualPriceUsdCents: number;
    /** RevenueCat offering ID for monthly. */
    readonly monthlyProductId: string;
    /** RevenueCat offering ID for annual. */
    readonly annualProductId: string;
    /** Trial days for this tier. 0 = no trial. */
    readonly trialDays: number;
}

export const SUBSCRIPTION_PRICING: readonly SubscriptionPricing[] = [
    {
        tier: 'free',
        monthlyPriceUsdCents: 0,
        annualPriceUsdCents: 0,
        monthlyProductId: '',
        annualProductId: '',
        trialDays: 0,
    },
    {
        tier: 'pro',
        monthlyPriceUsdCents: 999,
        annualPriceUsdCents: 9990, // 10 months (2 free)
        monthlyProductId: 'rc_pro_monthly',
        annualProductId: 'rc_pro_annual',
        trialDays: 7,
    },
    {
        tier: 'team',
        monthlyPriceUsdCents: 2999,
        annualPriceUsdCents: 29990,
        monthlyProductId: 'rc_team_monthly',
        annualProductId: 'rc_team_annual',
        trialDays: 7,
    },
    {
        tier: 'enterprise',
        monthlyPriceUsdCents: 9999,
        annualPriceUsdCents: 99990,
        monthlyProductId: 'rc_enterprise_monthly',
        annualProductId: 'rc_enterprise_annual',
        trialDays: 14,
    },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tier hierarchy for comparison. Higher index = higher tier. */
const TIER_ORDER: readonly UserTier[] = ['free', 'pro', 'team', 'enterprise'];

/** Get the numeric level of a tier (0-based). */
export function tierLevel(tier: UserTier): number {
    const idx = TIER_ORDER.indexOf(tier);
    return idx === -1 ? 0 : idx;
}

/** Check if `userTier` meets the minimum required tier. */
export function meetsMinimumTier(userTier: UserTier, requiredTier: UserTier): boolean {
    return tierLevel(userTier) >= tierLevel(requiredTier);
}

/** Get the limits for a given tier. */
export function getTierLimits(tier: UserTier): TierLimits {
    return TIER_LIMITS[tier];
}

/** Check if a limit value means "unlimited". */
export function isUnlimited(value: number): boolean {
    return value === -1;
}

/** Get pricing info for a tier. Returns undefined for unknown tiers. */
export function getTierPricing(tier: UserTier): SubscriptionPricing | undefined {
    return SUBSCRIPTION_PRICING.find((p) => p.tier === tier);
}

/** Format USD cents as a display string (e.g. 999 → "$9.99"). */
export function formatUsdCents(cents: number): string {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
}
