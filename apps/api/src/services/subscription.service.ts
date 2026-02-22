/**
 * Subscription service.
 *
 * Manages subscription lifecycle: creation, status updates, tier sync,
 * monthly credit grants, and cancellation. All DB operations are atomic.
 */
import { eq, and, desc, sql, inArray } from 'drizzle-orm';

import type { Database } from '../db/connection.js';
import { subscriptions, users } from '../db/schema.js';
import { AppError } from '../errors/errors.js';
import { TIER_LIMITS } from '@renderflow/shared';
import type { UserTier } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired';
type SubscriptionProvider = 'revenuecat' | 'stripe' | 'manual';

export interface CreateSubscriptionInput {
    userId: string;
    tier: UserTier;
    status: SubscriptionStatus;
    provider: SubscriptionProvider;
    providerSubscriptionId?: string;
    providerCustomerId?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    trialEnd?: Date;
}

export interface SubscriptionRow {
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

// ---------------------------------------------------------------------------
// Create subscription
// ---------------------------------------------------------------------------

/**
 * Create a new subscription record and sync the user's tier.
 * If an active subscription already exists, it is replaced.
 */
export async function createSubscription(
    db: Database,
    input: CreateSubscriptionInput,
): Promise<SubscriptionRow> {
    // Expire any existing active/trialing subscriptions for this user
    await db
        .update(subscriptions)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(
            and(
                eq(subscriptions.userId, input.userId),
                inArray(subscriptions.status, ['active', 'trialing']),
            ),
        );

    // Create new subscription
    const [row] = await db
        .insert(subscriptions)
        .values({
            userId: input.userId,
            tier: input.tier,
            status: input.status,
            provider: input.provider,
            providerSubscriptionId: input.providerSubscriptionId ?? null,
            providerCustomerId: input.providerCustomerId ?? null,
            currentPeriodStart: input.currentPeriodStart ?? null,
            currentPeriodEnd: input.currentPeriodEnd ?? null,
            trialEnd: input.trialEnd ?? null,
        })
        .returning();

    if (!row) {
        throw AppError.internal('Failed to create subscription');
    }

    // Sync user tier
    await syncUserTier(db, input.userId, input.tier);

    return row as SubscriptionRow;
}

// ---------------------------------------------------------------------------
// Get active subscription
// ---------------------------------------------------------------------------

/**
 * Get the currently active (or trialing) subscription for a user.
 * Returns null if no active subscription exists (free tier).
 */
export async function getActiveSubscription(
    db: Database,
    userId: string,
): Promise<SubscriptionRow | null> {
    const [row] = await db
        .select()
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.userId, userId),
                inArray(subscriptions.status, ['active', 'trialing', 'past_due']),
            ),
        )
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

    return (row as SubscriptionRow) ?? null;
}

// ---------------------------------------------------------------------------
// Get subscription by provider ID
// ---------------------------------------------------------------------------

/**
 * Look up a subscription by provider's subscription ID.
 * Used by webhooks to find the subscription to update.
 */
export async function getByProviderId(
    db: Database,
    providerSubscriptionId: string,
): Promise<SubscriptionRow | null> {
    const [row] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
        .limit(1);

    return (row as SubscriptionRow) ?? null;
}

// ---------------------------------------------------------------------------
// Update subscription status
// ---------------------------------------------------------------------------

/**
 * Update the status of a subscription and optionally sync the user tier.
 */
export async function updateSubscriptionStatus(
    db: Database,
    subscriptionId: string,
    status: SubscriptionStatus,
    updates?: {
        cancelAtPeriodEnd?: boolean;
        currentPeriodEnd?: Date;
        tier?: UserTier;
    },
): Promise<SubscriptionRow> {
    const setValues: Record<string, unknown> = {
        status,
        updatedAt: new Date(),
    };

    if (updates?.cancelAtPeriodEnd !== undefined) {
        setValues['cancelAtPeriodEnd'] = updates.cancelAtPeriodEnd;
    }
    if (updates?.currentPeriodEnd) {
        setValues['currentPeriodEnd'] = updates.currentPeriodEnd;
    }
    if (updates?.tier) {
        setValues['tier'] = updates.tier;
    }

    const [row] = await db
        .update(subscriptions)
        .set(setValues)
        .where(eq(subscriptions.id, subscriptionId))
        .returning();

    if (!row) {
        throw AppError.notFound('Subscription not found');
    }

    // If status changed to expired or cancelled at period end, downgrade to free
    if (status === 'expired') {
        await syncUserTier(db, row.userId, 'free');
    }

    return row as SubscriptionRow;
}

// ---------------------------------------------------------------------------
// Cancel subscription
// ---------------------------------------------------------------------------

/**
 * Mark a subscription to cancel at the end of the billing period.
 * Does NOT immediately downgrade — user keeps access until period ends.
 */
export async function cancelSubscription(
    db: Database,
    subscriptionId: string,
): Promise<SubscriptionRow> {
    return updateSubscriptionStatus(db, subscriptionId, 'cancelled', {
        cancelAtPeriodEnd: true,
    });
}

// ---------------------------------------------------------------------------
// Grant monthly credits
// ---------------------------------------------------------------------------

/**
 * Add the monthly credit allotment for a tier to a user's balance.
 * Called on subscription creation and each renewal.
 */
export async function grantMonthlyCredits(
    db: Database,
    userId: string,
    tier: UserTier,
): Promise<number> {
    const limits = TIER_LIMITS[tier];
    const amount = limits.monthlyCredits;

    // Unlimited tiers or free tier get no monthly grant
    if (amount <= 0) {
        // For enterprise (unlimited = -1), set a large balance
        if (amount === -1) {
            const [result] = await db
                .update(users)
                .set({
                    renderCredits: 99999,
                    updatedAt: new Date(),
                })
                .where(eq(users.id, userId))
                .returning({ renderCredits: users.renderCredits });

            return result?.renderCredits ?? 0;
        }

        const [user] = await db
            .select({ renderCredits: users.renderCredits })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        return user?.renderCredits ?? 0;
    }

    const [result] = await db
        .update(users)
        .set({
            renderCredits: sql`${users.renderCredits} + ${amount}`,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({ renderCredits: users.renderCredits });

    if (!result) {
        throw AppError.notFound('User not found');
    }

    return result.renderCredits;
}

// ---------------------------------------------------------------------------
// Sync user tier
// ---------------------------------------------------------------------------

/**
 * Update the user's tier column to match their subscription.
 * Called after subscription state changes.
 */
async function syncUserTier(
    db: Database,
    userId: string,
    tier: UserTier,
): Promise<void> {
    await db
        .update(users)
        .set({ tier, updatedAt: new Date() })
        .where(eq(users.id, userId));
}

// ---------------------------------------------------------------------------
// Usage summary
// ---------------------------------------------------------------------------

export interface UsageSummary {
    creditBalance: number;
    storageUsedBytes: number;
    rendersToday: number;
    tier: string;
    subscription: SubscriptionRow | null;
}

/**
 * Aggregates usage metrics for the settings/usage dashboard.
 */
export async function getUsageSummary(
    db: Database,
    userId: string,
): Promise<UsageSummary> {
    // Parallel queries for efficiency
    const [userResult, subscriptionResult, storageResult, renderCountResult] = await Promise.all([
        db.select({ tier: users.tier, renderCredits: users.renderCredits })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1),
        getActiveSubscription(db, userId),
        getStorageUsed(db, userId),
        getDailyRenderCount(db, userId),
    ]);

    const user = userResult[0];
    if (!user) {
        throw AppError.notFound('User not found');
    }

    return {
        creditBalance: user.renderCredits,
        storageUsedBytes: storageResult,
        rendersToday: renderCountResult,
        tier: user.tier,
        subscription: subscriptionResult,
    };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getStorageUsed(db: Database, userId: string): Promise<number> {
    // Import assets dynamically to avoid circular dependency
    const { assets } = await import('../db/schema.js');
    const [result] = await db
        .select({ total: sql<number>`coalesce(sum(${assets.fileSize}), 0)::bigint` })
        .from(assets)
        .where(eq(assets.userId, userId));

    return Number(result?.total ?? 0);
}

async function getDailyRenderCount(db: Database, userId: string): Promise<number> {
    const { renderJobs } = await import('../db/schema.js');
    const { gte } = await import('drizzle-orm');

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(renderJobs)
        .where(
            and(
                eq(renderJobs.userId, userId),
                gte(renderJobs.createdAt, startOfDay),
            ),
        );

    return result?.count ?? 0;
}
