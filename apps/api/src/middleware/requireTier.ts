/**
 * Tier-gating middleware.
 *
 * Checks that the authenticated user's tier meets the minimum required.
 * Must be used AFTER the `authenticate` middleware.
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserTier } from '@renderflow/shared';

import { getDatabase } from '../db/connection.js';
import { users } from '../db/schema.js';
import { AppError } from '../errors/errors.js';
import { eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Tier hierarchy (higher index = higher tier)
// ---------------------------------------------------------------------------

const TIER_ORDER: readonly UserTier[] = ['free', 'pro', 'team', 'enterprise'];

function tierLevel(tier: UserTier): number {
    const idx = TIER_ORDER.indexOf(tier);
    return idx === -1 ? 0 : idx;
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * Returns a `preHandler` hook that requires the user to be on
 * at least the specified tier.
 *
 * Usage:
 *   app.get('/pro-only', { preHandler: [authenticate, requireTier('pro')] }, handler)
 */
export function requireTier(minimumTier: UserTier) {
    return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
        const db = getDatabase();

        const [user] = await db
            .select({ tier: users.tier })
            .from(users)
            .where(eq(users.id, request.userId))
            .limit(1);

        if (!user) {
            throw AppError.unauthorized('User not found');
        }

        const userLevel = tierLevel(user.tier as UserTier);
        const requiredLevel = tierLevel(minimumTier);

        if (userLevel < requiredLevel) {
            throw AppError.forbidden(
                `This feature requires a ${minimumTier} tier or higher`,
            );
        }
    };
}
