/**
 * Webhook routes for payment providers.
 *
 * POST /webhooks/stripe     — Stripe subscription and checkout events
 * POST /webhooks/revenuecat — RevenueCat server-to-server notifications
 *
 * These routes skip authentication middleware — they verify provider
 * signatures/auth keys instead. Raw body parsing is required for
 * Stripe signature verification.
 */
import crypto from 'node:crypto';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { getDatabase } from '../db/connection.js';
import { getEnv } from '../config/env.js';
import { AppError } from '../errors/errors.js';
import * as subscriptionService from '../services/subscription.service.js';
import * as creditService from '../services/credit.service.js';
import { CREDIT_PACKS } from '@renderflow/shared';
import type { UserTier } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Stripe signature verification
// ---------------------------------------------------------------------------

/**
 * Verify a Stripe webhook signature using HMAC-SHA256.
 *
 * Stripe sends a `Stripe-Signature` header with format:
 *   t=<timestamp>,v1=<signature>,v0=<signature>
 *
 * We verify the v1 signature against `t.<rawBody>`.
 */
function verifyStripeSignature(
    rawBody: string,
    signatureHeader: string,
    secret: string,
): boolean {
    const elements = signatureHeader.split(',');
    const timestampStr = elements.find((e) => e.startsWith('t='))?.slice(2);
    const signature = elements.find((e) => e.startsWith('v1='))?.slice(3);

    if (!timestampStr || !signature) {
        return false;
    }

    // Reject signatures older than 5 minutes (replay protection)
    const timestamp = parseInt(timestampStr, 10);
    const tolerance = 300; // 5 minutes
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > tolerance) {
        return false;
    }

    const payload = `${timestampStr}.${rawBody}`;
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
    );
}

// ---------------------------------------------------------------------------
// Stripe event type mapping
// ---------------------------------------------------------------------------

interface StripeSubscriptionData {
    id: string;
    customer: string;
    status: string;
    current_period_start: number;
    current_period_end: number;
    cancel_at_period_end: boolean;
    trial_end: number | null;
    items: {
        data: Array<{
            price: {
                id: string;
                product: string;
                lookup_key?: string;
            };
        }>;
    };
    metadata?: Record<string, string>;
}

interface StripeCheckoutSessionData {
    id: string;
    customer: string;
    metadata?: Record<string, string>;
    line_items?: {
        data: Array<{
            price: {
                id: string;
                lookup_key?: string;
            };
            quantity: number;
        }>;
    };
}

interface StripeEvent {
    id: string;
    type: string;
    data: {
        object: StripeSubscriptionData | StripeCheckoutSessionData;
    };
}

/** Map a Stripe price lookup_key or metadata to a UserTier. */
function resolveTierFromStripeSubscription(sub: StripeSubscriptionData): UserTier {
    const firstItem = sub.items.data[0];
    const lookupKey = firstItem?.price?.lookup_key ?? '';
    const metaTier = sub.metadata?.['tier'];

    if (metaTier && ['pro', 'team', 'enterprise'].includes(metaTier)) {
        return metaTier as UserTier;
    }

    if (lookupKey.includes('enterprise')) return 'enterprise';
    if (lookupKey.includes('team')) return 'team';
    if (lookupKey.includes('pro')) return 'pro';

    return 'pro'; // Default paid tier
}

/** Map Stripe subscription status to our status enum. */
function mapStripeStatus(stripeStatus: string): 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired' {
    switch (stripeStatus) {
        case 'active': return 'active';
        case 'trialing': return 'trialing';
        case 'past_due': return 'past_due';
        case 'canceled': return 'cancelled';
        case 'unpaid': return 'past_due';
        case 'incomplete_expired': return 'expired';
        default: return 'expired';
    }
}

// ---------------------------------------------------------------------------
// RevenueCat event types
// ---------------------------------------------------------------------------

interface RevenueCatEvent {
    type: string;
    app_user_id: string;
    product_id: string;
    entitlement_ids?: string[];
    period_type?: string;
    expiration_at_ms?: number;
    event_timestamp_ms: number;
    store?: string;
    environment?: string;
}

interface RevenueCatWebhookPayload {
    api_version: string;
    event: RevenueCatEvent;
}

/** Map a RevenueCat product ID to a UserTier. */
function resolveTierFromRevenueCat(productId: string): UserTier {
    const lower = productId.toLowerCase();
    if (lower.includes('enterprise')) return 'enterprise';
    if (lower.includes('team')) return 'team';
    if (lower.includes('pro')) return 'pro';
    return 'pro'; // Default paid
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function webhookRoutes(app: FastifyInstance): Promise<void> {

    // -------------------------------------------------------------------
    // POST /webhooks/stripe
    // -------------------------------------------------------------------

    app.post(
        '/webhooks/stripe',
        async (request: FastifyRequest, reply: FastifyReply) => {
            const env = getEnv();

            if (!env.STRIPE_WEBHOOK_SECRET) {
                request.log.warn('STRIPE_WEBHOOK_SECRET not configured, rejecting webhook');
                throw AppError.internal('Webhook not configured');
            }

            // Verify signature
            const signatureHeader = request.headers['stripe-signature'];
            if (typeof signatureHeader !== 'string') {
                throw AppError.unauthorized('Missing Stripe-Signature header');
            }

            const rawBody = typeof request.body === 'string'
                ? request.body
                : JSON.stringify(request.body);

            if (!verifyStripeSignature(rawBody, signatureHeader, env.STRIPE_WEBHOOK_SECRET)) {
                throw AppError.unauthorized('Invalid Stripe webhook signature');
            }

            const event: StripeEvent = typeof request.body === 'string'
                ? JSON.parse(request.body) as StripeEvent
                : request.body as StripeEvent;

            const db = getDatabase();

            request.log.info({ eventType: event.type, eventId: event.id }, 'Processing Stripe webhook');

            switch (event.type) {
                case 'customer.subscription.created':
                case 'customer.subscription.updated': {
                    const sub = event.data.object as StripeSubscriptionData;
                    const tier = resolveTierFromStripeSubscription(sub);
                    const status = mapStripeStatus(sub.status);
                    const userId = sub.metadata?.['userId'];

                    if (!userId) {
                        request.log.warn({ subscriptionId: sub.id }, 'No userId in subscription metadata');
                        return reply.status(200).send({ received: true });
                    }

                    // Check if subscription already exists
                    const existing = await subscriptionService.getByProviderId(db, sub.id);

                    if (existing) {
                        await subscriptionService.updateSubscriptionStatus(
                            db,
                            existing.id,
                            status,
                            {
                                cancelAtPeriodEnd: sub.cancel_at_period_end,
                                currentPeriodEnd: new Date(sub.current_period_end * 1000),
                                tier,
                            },
                        );
                    } else {
                        await subscriptionService.createSubscription(db, {
                            userId,
                            tier,
                            status,
                            provider: 'stripe',
                            providerSubscriptionId: sub.id,
                            providerCustomerId: sub.customer,
                            currentPeriodStart: new Date(sub.current_period_start * 1000),
                            currentPeriodEnd: new Date(sub.current_period_end * 1000),
                            trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : undefined,
                        });

                        // Grant monthly credits on initial creation
                        await subscriptionService.grantMonthlyCredits(db, userId, tier);
                    }

                    break;
                }

                case 'customer.subscription.deleted': {
                    const sub = event.data.object as StripeSubscriptionData;
                    const existing = await subscriptionService.getByProviderId(db, sub.id);

                    if (existing) {
                        await subscriptionService.updateSubscriptionStatus(
                            db,
                            existing.id,
                            'expired',
                        );
                    }

                    break;
                }

                case 'invoice.payment_failed': {
                    const invoice = event.data.object as unknown as {
                        subscription: string;
                        customer: string;
                    };

                    if (invoice.subscription) {
                        const existing = await subscriptionService.getByProviderId(
                            db,
                            invoice.subscription,
                        );

                        if (existing) {
                            await subscriptionService.updateSubscriptionStatus(
                                db,
                                existing.id,
                                'past_due',
                            );
                        }
                    }

                    break;
                }

                case 'checkout.session.completed': {
                    // Credit pack purchase
                    const session = event.data.object as StripeCheckoutSessionData;
                    const userId = session.metadata?.['userId'];
                    const packId = session.metadata?.['creditPackId'];

                    if (userId && packId) {
                        const pack = CREDIT_PACKS.find((p) => p.id === packId);
                        if (pack) {
                            await creditService.refundCredits(
                                db,
                                userId,
                                pack.credits,
                                `Credit pack purchase: ${pack.label}`,
                            );
                            request.log.info(
                                { userId, packId, credits: pack.credits },
                                'Credits added from pack purchase',
                            );
                        }
                    }

                    break;
                }

                default:
                    request.log.debug({ eventType: event.type }, 'Unhandled Stripe event type');
            }

            return reply.status(200).send({ received: true });
        },
    );

    // -------------------------------------------------------------------
    // POST /webhooks/revenuecat
    // -------------------------------------------------------------------

    app.post(
        '/webhooks/revenuecat',
        async (request: FastifyRequest, reply: FastifyReply) => {
            const env = getEnv();

            // RevenueCat uses a simple Bearer token for webhook auth
            if (env.REVENUECAT_WEBHOOK_AUTH_KEY) {
                const authHeader = request.headers['authorization'];
                const expectedToken = `Bearer ${env.REVENUECAT_WEBHOOK_AUTH_KEY}`;

                if (authHeader !== expectedToken) {
                    throw AppError.unauthorized('Invalid RevenueCat webhook authorization');
                }
            }

            const payload = request.body as RevenueCatWebhookPayload;

            if (!payload?.event) {
                throw AppError.validation('Invalid RevenueCat webhook payload');
            }

            const { event } = payload;
            const db = getDatabase();

            request.log.info(
                { eventType: event.type, appUserId: event.app_user_id },
                'Processing RevenueCat webhook',
            );

            // app_user_id should be our userId (set during SDK configure)
            const userId = event.app_user_id;
            if (!userId) {
                request.log.warn('No app_user_id in RevenueCat event');
                return reply.status(200).send({ received: true });
            }

            const tier = resolveTierFromRevenueCat(event.product_id);

            switch (event.type) {
                case 'INITIAL_PURCHASE':
                case 'RENEWAL': {
                    const periodEnd = event.expiration_at_ms
                        ? new Date(event.expiration_at_ms)
                        : undefined;

                    await subscriptionService.createSubscription(db, {
                        userId,
                        tier,
                        status: event.period_type === 'TRIAL' ? 'trialing' : 'active',
                        provider: 'revenuecat',
                        providerSubscriptionId: `rc_${userId}_${event.product_id}`,
                        currentPeriodEnd: periodEnd,
                    });

                    await subscriptionService.grantMonthlyCredits(db, userId, tier);

                    break;
                }

                case 'CANCELLATION': {
                    const existing = await subscriptionService.getActiveSubscription(db, userId);

                    if (existing) {
                        await subscriptionService.updateSubscriptionStatus(
                            db,
                            existing.id,
                            'cancelled',
                            { cancelAtPeriodEnd: true },
                        );
                    }

                    break;
                }

                case 'BILLING_ISSUE': {
                    const existing = await subscriptionService.getActiveSubscription(db, userId);

                    if (existing) {
                        await subscriptionService.updateSubscriptionStatus(
                            db,
                            existing.id,
                            'past_due',
                        );
                    }

                    break;
                }

                case 'EXPIRATION': {
                    const existing = await subscriptionService.getActiveSubscription(db, userId);

                    if (existing) {
                        await subscriptionService.updateSubscriptionStatus(
                            db,
                            existing.id,
                            'expired',
                        );
                    }

                    break;
                }

                case 'PRODUCT_CHANGE': {
                    // User changed from one product to another
                    const newTier = resolveTierFromRevenueCat(event.product_id);
                    const existing = await subscriptionService.getActiveSubscription(db, userId);

                    if (existing) {
                        await subscriptionService.updateSubscriptionStatus(
                            db,
                            existing.id,
                            'active',
                            { tier: newTier },
                        );
                    }

                    break;
                }

                default:
                    request.log.debug({ eventType: event.type }, 'Unhandled RevenueCat event type');
            }

            return reply.status(200).send({ received: true });
        },
    );
}
