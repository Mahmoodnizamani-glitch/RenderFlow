/**
 * Queue service.
 *
 * Manages BullMQ render queues with priority-based routing per user tier.
 *
 * Queue architecture:
 *   render:free       — low priority (10), 1 concurrent per user
 *   render:pro        — medium priority (5), 3 concurrent per user
 *   render:enterprise — high priority (1), 10 concurrent per user
 *
 * Job lifecycle: 30-min timeout, 2 retries with exponential backoff.
 */
import { Queue } from 'bullmq';
import type { ConnectionOptions, JobsOptions } from 'bullmq';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QueueTier = 'free' | 'pro' | 'enterprise';

export interface RenderJobData {
    renderJobId: string;
    userId: string;
    projectId: string;
    codeUrl: string;
    assets: Array<{ name: string; url: string }>;
    compositionSettings: Record<string, unknown>;
    renderSettings: Record<string, unknown>;
}

export interface QueueStats {
    tier: QueueTier;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUEUE_NAMES: Record<QueueTier, string> = {
    free: 'render:free',
    pro: 'render:pro',
    enterprise: 'render:enterprise',
} as const;

/** Lower number = higher priority in BullMQ. */
const QUEUE_PRIORITIES: Record<QueueTier, number> = {
    free: 10,
    pro: 5,
    enterprise: 1,
} as const;

const _JOB_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_RETRIES = 2;

// ---------------------------------------------------------------------------
// Singleton queues
// ---------------------------------------------------------------------------

let _queues: Map<QueueTier, Queue> | null = null;

// ---------------------------------------------------------------------------
// Tier resolution
// ---------------------------------------------------------------------------

/**
 * Map a user tier string to the queue tier.
 * 'team' maps to 'enterprise' queue.
 */
export function resolveQueueTier(userTier: string): QueueTier {
    switch (userTier) {
        case 'enterprise':
        case 'team':
            return 'enterprise';
        case 'pro':
            return 'pro';
        default:
            return 'free';
    }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * Initialise BullMQ queues for each tier.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initQueues(connection: ConnectionOptions): Map<QueueTier, Queue> {
    if (_queues) return _queues;

    _queues = new Map();

    for (const tier of Object.keys(QUEUE_NAMES) as QueueTier[]) {
        const queue = new Queue(QUEUE_NAMES[tier], {
            connection,
            defaultJobOptions: {
                attempts: MAX_RETRIES + 1, // initial + retries
                backoff: {
                    type: 'exponential',
                    delay: 5000, // 5s base delay
                },
                removeOnComplete: {
                    age: 24 * 3600, // Keep completed jobs for 24h
                    count: 1000,
                },
                removeOnFail: {
                    age: 7 * 24 * 3600, // Keep failed jobs for 7 days
                    count: 5000,
                },
            },
        });

        _queues.set(tier, queue);
    }

    return _queues;
}

/**
 * Returns the initialised queue map.
 * Throws if `initQueues()` has not been called.
 */
export function getQueues(): Map<QueueTier, Queue> {
    if (!_queues) {
        throw new Error('Queues not initialised. Call initQueues() first.');
    }
    return _queues;
}

// ---------------------------------------------------------------------------
// Submit job
// ---------------------------------------------------------------------------

/**
 * Add a render job to the tier-appropriate BullMQ queue.
 * Returns the BullMQ job ID.
 */
export async function submitJob(
    tier: QueueTier,
    data: RenderJobData,
): Promise<string> {
    const queues = getQueues();
    const queue = queues.get(tier);

    if (!queue) {
        throw new Error(`Queue not found for tier: ${tier}`);
    }

    const jobOptions: JobsOptions = {
        priority: QUEUE_PRIORITIES[tier],
        jobId: data.renderJobId, // Use render job ID as BullMQ job ID
    };

    const job = await queue.add('render', data, jobOptions);

    return job.id ?? data.renderJobId;
}

// ---------------------------------------------------------------------------
// Cancel job
// ---------------------------------------------------------------------------

/**
 * Attempt to cancel a BullMQ job.
 * If the job is waiting, it will be removed.
 * If actively processing, it will be moved to failed state.
 *
 * Returns true if the job was removed/cancelled, false if not found.
 */
export async function cancelJob(
    bullmqJobId: string,
    tier: QueueTier,
): Promise<boolean> {
    const queues = getQueues();
    const queue = queues.get(tier);

    if (!queue) return false;

    const job = await queue.getJob(bullmqJobId);
    if (!job) return false;

    const state = await job.getState();

    if (state === 'waiting' || state === 'delayed' || state === 'prioritized') {
        await job.remove();
        return true;
    }

    if (state === 'active') {
        // Move to failed state — the worker should check for cancellation
        await job.moveToFailed(new Error('Job cancelled by user'), '0', true);
        return true;
    }

    // Job already completed/failed — cannot cancel
    return false;
}

// ---------------------------------------------------------------------------
// Get job status
// ---------------------------------------------------------------------------

/**
 * Get the current BullMQ status and progress for a job.
 */
export async function getJobBullMQStatus(
    bullmqJobId: string,
    tier: QueueTier,
): Promise<{ state: string; progress: number | object } | null> {
    const queues = getQueues();
    const queue = queues.get(tier);

    if (!queue) return null;

    const job = await queue.getJob(bullmqJobId);
    if (!job) return null;

    const state = await job.getState();
    const progress = job.progress;

    return { state, progress: typeof progress === 'number' ? progress : 0 };
}

// ---------------------------------------------------------------------------
// Queue statistics
// ---------------------------------------------------------------------------

/**
 * Returns queue depth and job count statistics per tier.
 */
export async function getQueueStats(): Promise<QueueStats[]> {
    const queues = getQueues();
    const stats: QueueStats[] = [];

    for (const [tier, queue] of queues) {
        const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
        );

        stats.push({
            tier,
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            completed: counts.completed ?? 0,
            failed: counts.failed ?? 0,
            delayed: counts.delayed ?? 0,
        });
    }

    return stats;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Gracefully close all queues.
 */
export async function closeQueues(): Promise<void> {
    if (_queues) {
        for (const queue of _queues.values()) {
            await queue.close();
        }
        _queues = null;
    }
}

/**
 * Reset queue singletons. **Test-only.**
 */
export function resetQueues(): void {
    _queues = null;
}
