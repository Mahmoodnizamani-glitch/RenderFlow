/**
 * Render worker event handler service.
 *
 * Provides functions invoked by BullMQ Worker event listeners to
 * update the render_jobs table as jobs progress through the pipeline.
 * Also emits real-time events via Socket.io for connected clients.
 *
 * These are pure event handlers — the actual Worker is registered
 * separately in the rendering infrastructure.
 */
import type { Database } from '../db/connection.js';
import * as renderService from './render.service.js';
import * as creditService from './credit.service.js';
import {
    emitRenderStarted,
    emitRenderProgress,
    emitRenderCompleted,
    emitRenderFailed,
    emitCreditsUpdated,
} from '../ws/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JobCompletedResult {
    outputUrl: string;
    outputSize: number;
}

export interface JobProgressData {
    progress: number;
    currentFrame: number;
    totalFrames: number;
    percentage?: number;
    stage?: string;
}

// ---------------------------------------------------------------------------
// Event: Job started (active)
// ---------------------------------------------------------------------------

/**
 * Called when a render job transitions to active state.
 * Updates DB status to 'processing' and records the start time.
 * Emits 'render:started' to connected clients.
 */
export async function onJobActive(
    db: Database,
    renderJobId: string,
    userId: string,
): Promise<void> {
    await renderService.updateRenderJobStatus(db, renderJobId, {
        status: 'processing',
        startedAt: new Date(),
    });

    emitRenderStarted(userId, renderJobId, {
        startedAt: new Date().toISOString(),
    });
}

// ---------------------------------------------------------------------------
// Event: Job progress
// ---------------------------------------------------------------------------

/**
 * Called when a worker reports render progress.
 * Updates frame count and percentage in the database.
 * Emits 'render:progress' to connected clients.
 */
export async function onJobProgress(
    db: Database,
    renderJobId: string,
    userId: string,
    data: JobProgressData,
): Promise<void> {
    await renderService.updateRenderJobStatus(db, renderJobId, {
        progress: data.progress,
        currentFrame: data.currentFrame,
        totalFrames: data.totalFrames,
    });

    emitRenderProgress(userId, renderJobId, {
        currentFrame: data.currentFrame,
        totalFrames: data.totalFrames,
        percentage: data.percentage ?? data.progress,
        stage: (data.stage as 'fetching' | 'preparing' | 'bundling' | 'rendering' | 'uploading') ?? 'rendering',
    });
}

// ---------------------------------------------------------------------------
// Event: Job completed
// ---------------------------------------------------------------------------

/**
 * Called when a render job finishes successfully.
 * Updates the status, output URL, file size, and completion time.
 * Emits 'render:completed' to connected clients.
 */
export async function onJobCompleted(
    db: Database,
    renderJobId: string,
    userId: string,
    result: JobCompletedResult,
    durationMs: number,
): Promise<void> {
    const completedAt = new Date();

    await renderService.updateRenderJobStatus(db, renderJobId, {
        status: 'completed',
        progress: 100,
        outputUrl: result.outputUrl,
        outputSize: result.outputSize,
        completedAt,
    });

    emitRenderCompleted(userId, renderJobId, {
        outputUrl: result.outputUrl,
        fileSize: result.outputSize,
        duration: durationMs,
        completedAt: completedAt.toISOString(),
    });
}

// ---------------------------------------------------------------------------
// Event: Job failed
// ---------------------------------------------------------------------------

/**
 * Called when a render job fails. Marks it as failed, records the
 * error message, and refunds the charged credits.
 * Emits 'render:failed' and 'credits:updated' to connected clients.
 */
export async function onJobFailed(
    db: Database,
    renderJobId: string,
    errorMessage: string,
    errorType: string = 'RENDER_ERROR',
): Promise<void> {
    // Get the job to know how many credits to refund
    const job = await renderService.getRenderJobByIdInternal(db, renderJobId);
    const completedAt = new Date();

    // Update status
    await renderService.updateRenderJobStatus(db, renderJobId, {
        status: 'failed',
        errorMessage,
        completedAt,
    });

    // Emit failure event
    emitRenderFailed(job.userId, renderJobId, {
        errorMessage,
        errorType,
        completedAt: completedAt.toISOString(),
    });

    // Refund credits if any were charged
    if (job.creditsCharged > 0) {
        await creditService.refundCredits(
            db,
            job.userId,
            job.creditsCharged,
            `Render job ${renderJobId} failed: ${errorMessage}`,
        );

        // Notify user of credit balance change
        // Need to fetch updated balance
        const balance = await creditService.getBalance(db, job.userId);
        emitCreditsUpdated(job.userId, balance);
    }
}

// ---------------------------------------------------------------------------
// Stale job check
// ---------------------------------------------------------------------------

const STALE_THRESHOLD_MINUTES = 35;

/**
 * Find and mark stale jobs (stuck in 'processing' for > 35 minutes)
 * as failed. Refunds credits for each stale job.
 */
export async function checkStaleJobs(db: Database): Promise<number> {
    const staleJobs = await renderService.findStaleJobs(db, STALE_THRESHOLD_MINUTES);

    for (const job of staleJobs) {
        await onJobFailed(
            db,
            job.id,
            `Job timed out after ${STALE_THRESHOLD_MINUTES} minutes`,
        );
    }

    return staleJobs.length;
}
