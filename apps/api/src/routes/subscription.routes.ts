/**
 * Subscription routes.
 *
 * GET /subscription        — Current subscription details
 * GET /subscription/usage  — Usage summary (credits, storage, renders)
 *
 * All routes require authentication.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { getDatabase } from '../db/connection.js';
import { authenticate } from '../middleware/authenticate.js';
import * as subscriptionService from '../services/subscription.service.js';
import { getTierLimits } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Serialiser
// ---------------------------------------------------------------------------

function serialiseSubscription(row: subscriptionService.SubscriptionRow) {
    return {
        id: row.id,
        userId: row.userId,
        tier: row.tier,
        status: row.status,
        provider: row.provider,
        currentPeriodStart: row.currentPeriodStart instanceof Date
            ? row.currentPeriodStart.toISOString()
            : row.currentPeriodStart,
        currentPeriodEnd: row.currentPeriodEnd instanceof Date
            ? row.currentPeriodEnd.toISOString()
            : row.currentPeriodEnd,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        trialEnd: row.trialEnd instanceof Date
            ? row.trialEnd.toISOString()
            : row.trialEnd,
        createdAt: row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : row.createdAt,
    };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
    app.addHook('preHandler', authenticate);

    // -------------------------------------------------------------------
    // GET /subscription — Current subscription
    // -------------------------------------------------------------------

    app.get(
        '/subscription',
        async (request: FastifyRequest, reply: FastifyReply) => {
            const db = getDatabase();
            const subscription = await subscriptionService.getActiveSubscription(
                db,
                request.userId,
            );

            return reply.status(200).send({
                subscription: subscription
                    ? serialiseSubscription(subscription)
                    : null,
            });
        },
    );

    // -------------------------------------------------------------------
    // GET /subscription/usage — Usage summary
    // -------------------------------------------------------------------

    app.get(
        '/subscription/usage',
        async (request: FastifyRequest, reply: FastifyReply) => {
            const db = getDatabase();
            const usage = await subscriptionService.getUsageSummary(
                db,
                request.userId,
            );

            const limits = getTierLimits(usage.tier as Parameters<typeof getTierLimits>[0]);

            return reply.status(200).send({
                usage: {
                    creditBalance: usage.creditBalance,
                    storageUsedBytes: usage.storageUsedBytes,
                    storageLimitBytes: limits.storageBytes,
                    rendersToday: usage.rendersToday,
                    maxRendersPerDay: limits.maxRendersPerDay,
                    tier: usage.tier,
                },
                subscription: usage.subscription
                    ? serialiseSubscription(usage.subscription)
                    : null,
            });
        },
    );
}
