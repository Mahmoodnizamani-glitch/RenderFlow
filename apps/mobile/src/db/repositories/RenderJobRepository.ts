/**
 * Repository for RenderJob CRUD operations.
 *
 * All methods are async, return validated types, and throw AppError on failure.
 */
import { eq, desc, sql } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import type {
    RenderJob,
    CreateRenderJobInput,
    RenderJobStatus,
} from '@renderflow/shared';
import { RenderJobSchema } from '@renderflow/shared';
import { getDb } from '../client';
import { renderJobs } from '../schema';
import { AppError } from '../../errors/AppError';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
    return new Date().toISOString();
}

function toRenderJob(row: typeof renderJobs.$inferSelect): RenderJob {
    const parsed = RenderJobSchema.safeParse(row);

    if (!parsed.success) {
        throw AppError.validation(
            `Invalid render job data for id "${row.id}"`,
            new Error(parsed.error.message),
        );
    }

    return parsed.data;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GetAllRenderJobsOptions {
    status?: RenderJobStatus;
    limit?: number;
    offset?: number;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const RenderJobRepository = {
    async create(input: CreateRenderJobInput): Promise<RenderJob> {
        const db = getDb();
        const id = randomUUID();
        const timestamp = now();

        const values = {
            id,
            projectId: input.projectId,
            status: 'queued' as const,
            renderType: input.renderType ?? 'cloud',
            format: input.format ?? 'mp4',
            quality: input.quality ?? 80,
            resolution: input.resolution ?? '1920x1080',
            fps: input.fps ?? 30,
            progress: 0,
            currentFrame: 0,
            totalFrames: input.totalFrames ?? 0,
            outputUri: null,
            remoteJobId: null,
            errorMessage: null,
            startedAt: null,
            completedAt: null,
            createdAt: timestamp,
        };

        try {
            await db.insert(renderJobs).values(values);
        } catch (error: unknown) {
            throw AppError.database(
                `Failed to create render job for project "${input.projectId}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }

        return toRenderJob(values);
    },

    async getById(id: string): Promise<RenderJob> {
        const db = getDb();

        try {
            const rows = await db
                .select()
                .from(renderJobs)
                .where(eq(renderJobs.id, id))
                .limit(1);
            const row = rows[0];

            if (!row) {
                throw AppError.notFound('RenderJob', id);
            }

            return toRenderJob(row);
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                `Failed to fetch render job "${id}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    async getByProject(projectId: string): Promise<RenderJob[]> {
        const db = getDb();

        try {
            const rows = await db
                .select()
                .from(renderJobs)
                .where(eq(renderJobs.projectId, projectId))
                .orderBy(desc(renderJobs.createdAt));
            return rows.map(toRenderJob);
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                `Failed to fetch render jobs for project "${projectId}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    async getAll(opts: GetAllRenderJobsOptions = {}): Promise<RenderJob[]> {
        const db = getDb();

        try {
            let query = db.select().from(renderJobs);

            if (opts.status) {
                query = query.where(eq(renderJobs.status, opts.status)) as typeof query;
            }

            query = query.orderBy(desc(renderJobs.createdAt)) as typeof query;

            if (opts.limit !== undefined) {
                query = query.limit(opts.limit) as typeof query;
            }
            if (opts.offset !== undefined) {
                query = query.offset(opts.offset) as typeof query;
            }

            const rows = await query;
            return rows.map(toRenderJob);
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                'Failed to fetch render jobs',
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    async updateProgress(
        id: string,
        progress: number,
        currentFrame: number,
    ): Promise<RenderJob> {
        const db = getDb();

        try {
            await RenderJobRepository.getById(id);

            await db
                .update(renderJobs)
                .set({ progress, currentFrame })
                .where(eq(renderJobs.id, id));

            return RenderJobRepository.getById(id);
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                `Failed to update progress for render job "${id}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    async updateStatus(
        id: string,
        status: RenderJobStatus,
        extra?: Partial<
            Pick<RenderJob, 'outputUri' | 'remoteJobId' | 'errorMessage' | 'startedAt' | 'completedAt'>
        >,
    ): Promise<RenderJob> {
        const db = getDb();

        try {
            await RenderJobRepository.getById(id);

            const updateData: Record<string, unknown> = { status };

            if (extra?.outputUri !== undefined) updateData.outputUri = extra.outputUri;
            if (extra?.remoteJobId !== undefined) updateData.remoteJobId = extra.remoteJobId;
            if (extra?.errorMessage !== undefined) updateData.errorMessage = extra.errorMessage;
            if (extra?.startedAt !== undefined) updateData.startedAt = extra.startedAt;
            if (extra?.completedAt !== undefined) updateData.completedAt = extra.completedAt;

            // Auto-set timing fields based on status transitions
            if (status === 'processing' && !extra?.startedAt) {
                updateData.startedAt = now();
            }
            if ((status === 'completed' || status === 'failed') && !extra?.completedAt) {
                updateData.completedAt = now();
            }
            if (status === 'completed') {
                updateData.progress = 100;
            }

            await db.update(renderJobs).set(updateData).where(eq(renderJobs.id, id));

            return RenderJobRepository.getById(id);
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                `Failed to update status for render job "${id}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    async getLatest(projectId: string): Promise<RenderJob | null> {
        const db = getDb();

        try {
            const rows = await db
                .select()
                .from(renderJobs)
                .where(eq(renderJobs.projectId, projectId))
                .orderBy(desc(renderJobs.createdAt))
                .limit(1);

            const row = rows[0];
            return row ? toRenderJob(row) : null;
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                `Failed to fetch latest render job for project "${projectId}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    async count(projectId?: string): Promise<number> {
        const db = getDb();

        try {
            let query = db.select({ count: sql<number>`COUNT(*)` }).from(renderJobs);

            if (projectId) {
                query = query.where(eq(renderJobs.projectId, projectId)) as typeof query;
            }

            const result = await query;
            return result[0]?.count ?? 0;
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                'Failed to count render jobs',
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    async delete(id: string): Promise<void> {
        const db = getDb();

        try {
            const result = await db
                .delete(renderJobs)
                .where(eq(renderJobs.id, id))
                .returning({ id: renderJobs.id });

            if (result.length === 0) {
                throw AppError.notFound(`Render job "${id}" not found`);
            }
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                `Failed to delete render job "${id}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },
} as const;
