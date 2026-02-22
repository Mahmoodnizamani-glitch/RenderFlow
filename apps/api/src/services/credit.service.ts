/**
 * Credit service.
 *
 * Manages render credit calculations, atomic deductions, refunds,
 * and balance queries. Credit costs are based on render duration,
 * resolution, and output format.
 *
 * Credit formula:
 *   base = ceil(durationInFrames / fps)  (minutes, rounded up)
 *   multiplier = resolution_factor × format_factor
 *   cost = max(1, ceil(base × multiplier))
 *
 * Resolution factors: 1080p=1, 1440p=1.5, 4K=2
 * Format factors: MP4/WebM=1, GIF=0.5
 */
import { eq, sql, gte, and } from 'drizzle-orm';

import type { Database } from '../db/connection.js';
import { users, renderJobs } from '../db/schema.js';
import { AppError } from '../errors/errors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RenderSettings {
    width: number;
    height: number;
    fps: number;
    durationInFrames: number;
    format?: string;
}

// ---------------------------------------------------------------------------
// Resolution multiplier
// ---------------------------------------------------------------------------

function getResolutionMultiplier(height: number): number {
    if (height >= 2160) return 2;     // 4K
    if (height >= 1440) return 1.5;   // 1440p
    return 1;                          // 1080p and below
}

// ---------------------------------------------------------------------------
// Format multiplier
// ---------------------------------------------------------------------------

function getFormatMultiplier(format: string | undefined): number {
    if (format?.toLowerCase() === 'gif') return 0.5;
    return 1; // MP4, WebM, etc.
}

// ---------------------------------------------------------------------------
// Calculate cost
// ---------------------------------------------------------------------------

/**
 * Compute the credit cost for a render job based on duration,
 * resolution, and output format.
 *
 * Minimum cost is always 1 credit.
 */
export function calculateCost(settings: RenderSettings): number {
    const { durationInFrames, fps, height, format } = settings;

    if (durationInFrames <= 0 || fps <= 0) {
        return 1;
    }

    const durationMinutes = Math.ceil(durationInFrames / fps / 60);
    const resolutionFactor = getResolutionMultiplier(height);
    const formatFactor = getFormatMultiplier(format);

    return Math.max(1, Math.ceil(durationMinutes * resolutionFactor * formatFactor));
}

// ---------------------------------------------------------------------------
// Deduct credits (atomic)
// ---------------------------------------------------------------------------

/**
 * Atomically deduct credits from a user's balance.
 *
 * Uses a single `UPDATE … WHERE render_credits >= amount` to
 * prevent race conditions. Returns the new balance.
 *
 * @throws AppError.paymentRequired if the user has insufficient credits.
 * @throws AppError.notFound if the user doesn't exist.
 */
export async function deductCredits(
    db: Database,
    userId: string,
    amount: number,
): Promise<number> {
    if (amount <= 0) {
        throw AppError.validation('Credit amount must be positive');
    }

    const result = await db
        .update(users)
        .set({
            renderCredits: sql`${users.renderCredits} - ${amount}`,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(users.id, userId),
                gte(users.renderCredits, amount),
            ),
        )
        .returning({ renderCredits: users.renderCredits });

    if (result.length === 0) {
        // Check if user exists to differentiate errors
        const [user] = await db
            .select({ renderCredits: users.renderCredits })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            throw AppError.notFound('User not found');
        }

        throw AppError.paymentRequired(
            `Insufficient credits. Required: ${amount}, available: ${user.renderCredits}`,
        );
    }

    return result[0]!.renderCredits;
}

// ---------------------------------------------------------------------------
// Refund credits
// ---------------------------------------------------------------------------

/**
 * Atomically add credits back to a user's balance.
 * Used when a render job fails and needs a refund.
 */
export async function refundCredits(
    db: Database,
    userId: string,
    amount: number,
    _reason: string,
): Promise<number> {
    if (amount <= 0) {
        throw AppError.validation('Refund amount must be positive');
    }

    const result = await db
        .update(users)
        .set({
            renderCredits: sql`${users.renderCredits} + ${amount}`,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({ renderCredits: users.renderCredits });

    if (result.length === 0) {
        throw AppError.notFound('User not found');
    }

    return result[0]!.renderCredits;
}

// ---------------------------------------------------------------------------
// Get balance
// ---------------------------------------------------------------------------

/**
 * Returns the current credit balance for a user.
 */
export async function getBalance(
    db: Database,
    userId: string,
): Promise<number> {
    const [user] = await db
        .select({ renderCredits: users.renderCredits })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user) {
        throw AppError.notFound('User not found');
    }

    return user.renderCredits;
}

// ---------------------------------------------------------------------------
// Daily render count (for free tier limit)
// ---------------------------------------------------------------------------

/**
 * Returns the number of render jobs created today by the user.
 * Used to enforce the free tier's 3 renders/day limit.
 */
export async function getDailyRenderCount(
    db: Database,
    userId: string,
): Promise<number> {
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
