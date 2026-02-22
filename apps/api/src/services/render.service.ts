/**
 * Render service.
 *
 * Database CRUD for render jobs. All queries that serve user-facing
 * endpoints enforce user-ownership via WHERE clauses.
 */
import { eq, and, desc, asc, count, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import type { Database } from '../db/connection.js';
import { renderJobs } from '../db/schema.js';
import { AppError } from '../errors/errors.js';
import {
    type PaginationQuery,
    buildPaginatedResponse,
    calcOffset,
    type PaginatedResponse,
} from '../utils/pagination.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RenderJobStatus = 'queued' | 'processing' | 'encoding' | 'completed' | 'failed' | 'cancelled';

export interface RenderJobRow {
    id: string;
    userId: string;
    projectId: string;
    status: string;
    renderType: string;
    settings: unknown;
    creditsCharged: number;
    codeUrl: string | null;
    bullmqJobId: string | null;
    progress: number;
    currentFrame: number;
    totalFrames: number;
    outputUrl: string | null;
    outputSize: number | null;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
}

export interface CreateRenderJobData {
    projectId: string;
    settings: Record<string, unknown>;
    creditsCharged: number;
    codeUrl: string;
    bullmqJobId: string;
    totalFrames: number;
}

export interface UpdateRenderJobData {
    status?: RenderJobStatus;
    progress?: number;
    currentFrame?: number;
    totalFrames?: number;
    outputUrl?: string;
    outputSize?: number;
    errorMessage?: string;
    startedAt?: Date;
    completedAt?: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toRenderJobRow(row: typeof renderJobs.$inferSelect): RenderJobRow {
    return {
        id: row.id,
        userId: row.userId,
        projectId: row.projectId,
        status: row.status,
        renderType: row.renderType,
        settings: row.settings,
        creditsCharged: row.creditsCharged,
        codeUrl: row.codeUrl,
        bullmqJobId: row.bullmqJobId,
        progress: row.progress,
        currentFrame: row.currentFrame,
        totalFrames: row.totalFrames,
        outputUrl: row.outputUrl,
        outputSize: row.outputSize,
        errorMessage: row.errorMessage,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        createdAt: row.createdAt,
    };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createRenderJob(
    db: Database,
    userId: string,
    data: CreateRenderJobData,
): Promise<RenderJobRow> {
    const [inserted] = await db
        .insert(renderJobs)
        .values({
            userId,
            projectId: data.projectId,
            status: 'queued',
            renderType: 'cloud',
            settings: data.settings,
            creditsCharged: data.creditsCharged,
            codeUrl: data.codeUrl,
            bullmqJobId: data.bullmqJobId,
            totalFrames: data.totalFrames,
        })
        .returning();

    if (!inserted) {
        throw AppError.internal('Failed to create render job');
    }

    return toRenderJobRow(inserted);
}

// ---------------------------------------------------------------------------
// Get by ID (user-scoped)
// ---------------------------------------------------------------------------

export async function getRenderJobById(
    db: Database,
    renderJobId: string,
    userId: string,
): Promise<RenderJobRow> {
    const [job] = await db
        .select()
        .from(renderJobs)
        .where(and(eq(renderJobs.id, renderJobId), eq(renderJobs.userId, userId)))
        .limit(1);

    if (!job) {
        throw AppError.notFound('Render job not found');
    }

    return toRenderJobRow(job);
}

// ---------------------------------------------------------------------------
// Get by ID (internal — no ownership check, for workers)
// ---------------------------------------------------------------------------

export async function getRenderJobByIdInternal(
    db: Database,
    renderJobId: string,
): Promise<RenderJobRow> {
    const [job] = await db
        .select()
        .from(renderJobs)
        .where(eq(renderJobs.id, renderJobId))
        .limit(1);

    if (!job) {
        throw AppError.notFound('Render job not found');
    }

    return toRenderJobRow(job);
}

// ---------------------------------------------------------------------------
// List (paginated, filterable by status)
// ---------------------------------------------------------------------------

export interface RenderJobListQuery extends PaginationQuery {
    status?: string;
}

export async function listRenderJobs(
    db: Database,
    userId: string,
    query: RenderJobListQuery,
): Promise<PaginatedResponse<RenderJobRow>> {
    const { page, limit, status, sortOrder } = query;

    const conditions: SQL[] = [eq(renderJobs.userId, userId)];

    if (status) {
        conditions.push(eq(renderJobs.status, status as RenderJobStatus));
    }

    const whereCondition = and(...conditions)!;

    // Count
    const [countResult] = await db
        .select({ value: count() })
        .from(renderJobs)
        .where(whereCondition);

    const total = countResult?.value ?? 0;

    const orderFn = sortOrder === 'asc' ? asc : desc;

    // Data
    const rows = await db
        .select()
        .from(renderJobs)
        .where(whereCondition)
        .orderBy(orderFn(renderJobs.createdAt))
        .limit(limit)
        .offset(calcOffset(page, limit));

    return buildPaginatedResponse(rows.map(toRenderJobRow), total, page, limit);
}

// ---------------------------------------------------------------------------
// Update status / progress
// ---------------------------------------------------------------------------

export async function updateRenderJobStatus(
    db: Database,
    renderJobId: string,
    data: UpdateRenderJobData,
): Promise<RenderJobRow> {
    const updateData: Record<string, unknown> = {};

    if (data.status !== undefined) updateData['status'] = data.status;
    if (data.progress !== undefined) updateData['progress'] = data.progress;
    if (data.currentFrame !== undefined) updateData['currentFrame'] = data.currentFrame;
    if (data.totalFrames !== undefined) updateData['totalFrames'] = data.totalFrames;
    if (data.outputUrl !== undefined) updateData['outputUrl'] = data.outputUrl;
    if (data.outputSize !== undefined) updateData['outputSize'] = data.outputSize;
    if (data.errorMessage !== undefined) updateData['errorMessage'] = data.errorMessage;
    if (data.startedAt !== undefined) updateData['startedAt'] = data.startedAt;
    if (data.completedAt !== undefined) updateData['completedAt'] = data.completedAt;

    if (Object.keys(updateData).length === 0) {
        return getRenderJobByIdInternal(db, renderJobId);
    }

    const [updated] = await db
        .update(renderJobs)
        .set(updateData)
        .where(eq(renderJobs.id, renderJobId))
        .returning();

    if (!updated) {
        throw AppError.notFound('Render job not found');
    }

    return toRenderJobRow(updated);
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

/**
 * Mark a render job as cancelled. Only allowed if the job is
 * in 'queued' or 'processing' state.
 */
export async function cancelRenderJob(
    db: Database,
    renderJobId: string,
    userId: string,
): Promise<RenderJobRow> {
    const job = await getRenderJobById(db, renderJobId, userId);

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        throw AppError.conflict(
            `Cannot cancel a render job with status '${job.status}'`,
        );
    }

    return updateRenderJobStatus(db, renderJobId, {
        status: 'cancelled',
        completedAt: new Date(),
    });
}

// ---------------------------------------------------------------------------
// Find stale jobs
// ---------------------------------------------------------------------------

/**
 * Find render jobs that have been processing for longer than
 * the specified minutes. Used by the stale-job checker.
 */
export async function findStaleJobs(
    db: Database,
    olderThanMinutes: number,
): Promise<RenderJobRow[]> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

    const rows = await db
        .select()
        .from(renderJobs)
        .where(
            and(
                eq(renderJobs.status, 'processing'),
                sql`${renderJobs.startedAt} < ${cutoff}`,
            ),
        );

    return rows.map(toRenderJobRow);
}
