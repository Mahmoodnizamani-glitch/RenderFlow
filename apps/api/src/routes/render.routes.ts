/**
 * Render routes.
 *
 * POST   /renders             — Submit render job
 * GET    /renders             — List user's render jobs (paginated)
 * GET    /renders/:id         — Get render job status
 * POST   /renders/:id/cancel  — Cancel render job
 * GET    /renders/:id/download — Get signed download URL
 * GET    /renders/queue/stats — Queue statistics (admin only)
 *
 * All routes require authentication.
 */
import { z } from 'zod';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { getDatabase } from '../db/connection.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/authenticate.js';
import { requireTier } from '../middleware/requireTier.js';
import { AppError } from '../errors/errors.js';
import * as creditService from '../services/credit.service.js';
import * as queueService from '../services/queue.service.js';
import * as renderService from '../services/render.service.js';
import { writeAuditLog, extractClientIp, extractUserAgent } from '../services/audit.service.js';
import { PaginationQuerySchema } from '../utils/pagination.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const SubmitRenderBodySchema = z.object({
    projectId: z.string().uuid('Invalid project ID'),
    settings: z.object({
        width: z.number().int().min(1).max(3840),
        height: z.number().int().min(1).max(2160),
        fps: z.number().int().min(1).max(120),
        durationInFrames: z.number().int().min(1).max(108000), // 1 hour at 30fps
        format: z.enum(['mp4', 'webm', 'gif']).default('mp4'),
    }),
    codeUrl: z.string().url('Invalid code URL'),
    assets: z.array(
        z.object({
            name: z.string().min(1),
            url: z.string().url(),
        }),
    ).default([]),
    compositionSettings: z.record(z.unknown()).default({}),
});

const RenderIdParamsSchema = z.object({
    id: z.string().uuid('Invalid render job ID'),
});

const RenderListQuerySchema = PaginationQuerySchema.extend({
    status: z.enum(['queued', 'processing', 'encoding', 'completed', 'failed', 'cancelled']).optional(),
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FREE_TIER_MAX_DAILY_RENDERS = 3;
const FREE_TIER_MAX_HEIGHT = 720;

// ---------------------------------------------------------------------------
// Serialiser
// ---------------------------------------------------------------------------

function serialiseRenderJob(row: renderService.RenderJobRow) {
    return {
        id: row.id,
        userId: row.userId,
        projectId: row.projectId,
        status: row.status,
        renderType: row.renderType,
        settings: row.settings,
        creditsCharged: row.creditsCharged,
        progress: row.progress,
        currentFrame: row.currentFrame,
        totalFrames: row.totalFrames,
        outputUrl: row.outputUrl,
        outputSize: row.outputSize,
        errorMessage: row.errorMessage,
        startedAt: row.startedAt instanceof Date ? row.startedAt.toISOString() : row.startedAt,
        completedAt: row.completedAt instanceof Date ? row.completedAt.toISOString() : row.completedAt,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function renderRoutes(app: FastifyInstance): Promise<void> {
    // All render routes require authentication
    app.addHook('preHandler', authenticate);

    // -------------------------------------------------------------------
    // POST /renders — Submit render job
    // -------------------------------------------------------------------

    app.post(
        '/renders',
        {
            config: {
                rateLimit: { max: 20, timeWindow: 3_600_000 }, // 20/hour
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const body = SubmitRenderBodySchema.parse(request.body);
            const db = getDatabase();

            // 1. Get user tier
            const [user] = await db
                .select({ tier: users.tier, renderCredits: users.renderCredits })
                .from(users)
                .where(eq(users.id, request.userId))
                .limit(1);

            if (!user) {
                throw AppError.unauthorized('User not found');
            }

            const queueTier = queueService.resolveQueueTier(user.tier);

            // 2. Free tier restrictions - TEMPORARILY DISABLED
            /* if (user.tier === 'free') {
                // Resolution cap
                if (body.settings.height > FREE_TIER_MAX_HEIGHT) {
                    throw AppError.forbidden(
                        `Free tier is limited to ${FREE_TIER_MAX_HEIGHT}p resolution. Upgrade to Pro for higher resolutions.`,
                    );
                }

                // Daily render limit
                const dailyCount = await creditService.getDailyRenderCount(db, request.userId);
                if (dailyCount >= FREE_TIER_MAX_DAILY_RENDERS) {
                    throw AppError.rateLimited(
                        `Free tier is limited to ${FREE_TIER_MAX_DAILY_RENDERS} renders per day. Upgrade to Pro for unlimited renders.`,
                    );
                }
            } */

            // 3. Calculate and deduct credits
            const cost = 0; // creditService.calculateCost(body.settings);
            // await creditService.deductCredits(db, request.userId, cost);

            // 4. Calculate total frames for progress tracking
            const totalFrames = body.settings.durationInFrames;

            // 5. Submit to BullMQ queue
            const bullmqJobId = crypto.randomUUID();

            const jobData: queueService.RenderJobData = {
                renderJobId: bullmqJobId,
                userId: request.userId,
                projectId: body.projectId,
                codeUrl: body.codeUrl,
                assets: body.assets,
                compositionSettings: body.compositionSettings,
                renderSettings: body.settings as unknown as Record<string, unknown>,
            };

            await queueService.submitJob(queueTier, jobData);

            // 6. Create DB record
            const renderJob = await renderService.createRenderJob(db, request.userId, {
                projectId: body.projectId,
                settings: body.settings as unknown as Record<string, unknown>,
                creditsCharged: cost,
                codeUrl: body.codeUrl,
                bullmqJobId,
                totalFrames,
            });

            void writeAuditLog(db, {
                userId: request.userId,
                action: 'render_submit',
                resourceType: 'render_job',
                resourceId: renderJob.id,
                ip: extractClientIp(request),
                userAgent: extractUserAgent(request),
                metadata: { projectId: body.projectId, creditsCharged: cost },
            });

            return reply.status(201).send({ renderJob: serialiseRenderJob(renderJob) });
        },
    );

    // -------------------------------------------------------------------
    // GET /renders — List user's render jobs
    // -------------------------------------------------------------------

    app.get(
        '/renders',
        async (request: FastifyRequest, reply: FastifyReply) => {
            const query = RenderListQuerySchema.parse(request.query);
            const db = getDatabase();

            const result = await renderService.listRenderJobs(
                db,
                request.userId,
                query,
            );

            return reply.status(200).send({
                data: result.data.map(serialiseRenderJob),
                meta: result.meta,
            });
        },
    );

    // -------------------------------------------------------------------
    // GET /renders/queue/stats — Queue statistics (admin only)
    // Must be registered BEFORE /renders/:id to avoid route conflict
    // -------------------------------------------------------------------

    app.get(
        '/renders/queue/stats',
        { preHandler: [requireTier('enterprise')] },
        async (_request: FastifyRequest, reply: FastifyReply) => {
            const stats = await queueService.getQueueStats();
            return reply.status(200).send({ stats });
        },
    );

    // -------------------------------------------------------------------
    // GET /renders/:id — Get render job status
    // -------------------------------------------------------------------

    app.get(
        '/renders/:id',
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = RenderIdParamsSchema.parse(request.params);
            const db = getDatabase();

            const renderJob = await renderService.getRenderJobById(
                db,
                id,
                request.userId,
            );

            return reply.status(200).send({ renderJob: serialiseRenderJob(renderJob) });
        },
    );

    // -------------------------------------------------------------------
    // POST /renders/:id/cancel — Cancel render job
    // -------------------------------------------------------------------

    app.post(
        '/renders/:id/cancel',
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = RenderIdParamsSchema.parse(request.params);
            const db = getDatabase();

            // 1. Cancel in DB (validates ownership + state)
            const renderJob = await renderService.cancelRenderJob(db, id, request.userId);

            // 2. Cancel in BullMQ queue
            if (renderJob.bullmqJobId) {
                const [user] = await db
                    .select({ tier: users.tier })
                    .from(users)
                    .where(eq(users.id, request.userId))
                    .limit(1);

                if (user) {
                    const tier = queueService.resolveQueueTier(user.tier);
                    await queueService.cancelJob(renderJob.bullmqJobId, tier);
                }
            }

            // 3. Refund credits
            if (renderJob.creditsCharged > 0) {
                await creditService.refundCredits(
                    db,
                    request.userId,
                    renderJob.creditsCharged,
                    `User cancelled render job ${id}`,
                );
            }

            return reply.status(200).send({ renderJob: serialiseRenderJob(renderJob) });
        },
    );

    // -------------------------------------------------------------------
    // GET /renders/:id/download — Get signed download URL
    // -------------------------------------------------------------------

    app.get(
        '/renders/:id/download',
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = RenderIdParamsSchema.parse(request.params);
            const db = getDatabase();

            const renderJob = await renderService.getRenderJobById(db, id, request.userId);

            if (renderJob.status !== 'completed') {
                throw AppError.conflict(
                    `Render job is not completed. Current status: ${renderJob.status}`,
                );
            }

            if (!renderJob.outputUrl) {
                throw AppError.notFound('Render output not available');
            }

            // In a production setup, this would generate a time-limited
            // presigned URL from R2. For now, return the stored URL.
            return reply.status(200).send({
                downloadUrl: renderJob.outputUrl,
                expiresIn: 3600,
            });
        },
    );
}
