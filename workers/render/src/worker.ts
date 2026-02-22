/**
 * Render worker entry point.
 *
 * Connects to Redis, registers BullMQ workers on all three priority
 * queues, and processes render jobs through the pipeline.
 *
 * Architecture:
 *   - 1 BullMQ Worker per queue tier (free, pro, enterprise)
 *   - Concurrency: 1 job per worker instance (scaling via replicas)
 *   - 30-minute hard timeout per job
 *   - Graceful shutdown on SIGTERM/SIGINT
 */
import { Worker as BullMQWorker } from 'bullmq';
import type { Job, ConnectionOptions } from 'bullmq';

import { initWorkerEnv, getWorkerEnv } from './config/env.js';
import { initRedis, closeRedis, getRedis } from './config/redis.js';
import { logger, setLogLevel } from './config/logger.js';
import { startHealthServer, stopHealthServer, setReady, setActiveJobs } from './health.js';
import { executeRenderPipeline, createStorageClient } from './pipeline/index.js';
import type { StorageClient } from './pipeline/index.js';
import { RenderError } from './errors.js';
import type { RenderJobData, ProgressData } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUEUE_NAMES = ['render:free', 'render:pro', 'render:enterprise'] as const;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _workers: BullMQWorker[] = [];
let _activeJobCount = 0;
let _shuttingDown = false;

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

/**
 * Process a single render job from the queue.
 *
 * This is the core handler invoked by each BullMQ Worker.
 * It orchestrates the pipeline and maps results/errors back to BullMQ.
 */
async function processJob(
    job: Job<RenderJobData>,
    storage: StorageClient,
): Promise<{ outputUrl: string; outputSize: number }> {
    const { data } = job;
    const log = logger.child({ jobId: data.renderJobId, userId: data.userId });

    log.info('Job started', {
        projectId: data.projectId,
        queue: job.queueName,
    });

    _activeJobCount++;
    setActiveJobs(_activeJobCount);

    // Create abort controller for timeout
    const abortController = new AbortController();
    const env = getWorkerEnv();
    const timeout = setTimeout(() => {
        abortController.abort();
    }, env.JOB_TIMEOUT_MS);

    try {
        const result = await executeRenderPipeline({
            jobData: data,
            storage,
            progressCallback: async (progressData: ProgressData) => {
                await job.updateProgress({
                    currentFrame: progressData.currentFrame,
                    totalFrames: progressData.totalFrames,
                    percentage: progressData.percentage,
                    stage: progressData.stage,
                });
            },
            log,
            abortSignal: abortController.signal,
        });

        log.info('Job completed', {
            durationMs: result.durationMs,
            outputUrl: result.outputUrl,
            outputSize: result.outputSize,
        });

        return { outputUrl: result.outputUrl, outputSize: result.outputSize };
    } catch (error) {
        const renderError = RenderError.is(error)
            ? error
            : RenderError.classify('rendering', error);

        log.error('Job failed', {
            errorType: renderError.type,
            retryable: renderError.retryable,
            error: renderError.message,
        });

        // For non-retryable errors, throw with UnrecoverableError to
        // prevent BullMQ from retrying
        if (!renderError.retryable) {
            const unrecoverable = new Error(renderError.toUserString());
            unrecoverable.name = 'UnrecoverableError';
            throw unrecoverable;
        }

        throw new Error(renderError.toUserString());
    } finally {
        clearTimeout(timeout);
        _activeJobCount--;
        setActiveJobs(_activeJobCount);
    }
}

// ---------------------------------------------------------------------------
// Worker registration
// ---------------------------------------------------------------------------

/**
 * Register BullMQ workers on all three priority queues.
 */
function registerWorkers(storage: StorageClient): BullMQWorker[] {
    const env = getWorkerEnv();
    const redis = getRedis();
    const workers: BullMQWorker[] = [];

    for (const queueName of QUEUE_NAMES) {
        // Cast required: BullMQ bundles its own ioredis types which
        // are structurally identical but nominally different.
        const worker = new BullMQWorker<RenderJobData>(
            queueName,
            async (job) => processJob(job, storage),
            {
                connection: redis as unknown as ConnectionOptions,
                concurrency: env.WORKER_CONCURRENCY,
                removeOnComplete: { count: 100 },
                removeOnFail: { count: 500 },
            },
        );

        worker.on('completed', (job) => {
            logger.info('Job completed event', {
                jobId: job.data.renderJobId,
                queue: queueName,
            });
        });

        worker.on('failed', (job, err) => {
            logger.error('Job failed event', {
                jobId: job?.data.renderJobId,
                queue: queueName,
                error: err.message,
            });
        });

        worker.on('error', (err) => {
            logger.error('Worker error', {
                queue: queueName,
                error: err.message,
            });
        });

        workers.push(worker);
        logger.info('Worker registered', { queue: queueName });
    }

    return workers;
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(): Promise<void> {
    if (_shuttingDown) return;
    _shuttingDown = true;

    logger.info('Graceful shutdown initiated');
    setReady(false);

    // Close workers (waits for current jobs to finish)
    const closePromises = _workers.map(async (worker) => {
        try {
            await worker.close();
        } catch (err) {
            logger.error('Error closing worker', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    });

    await Promise.all(closePromises);
    logger.info('All workers closed');

    // Close health server
    await stopHealthServer();
    logger.info('Health server stopped');

    // Close Redis
    await closeRedis();
    logger.info('Redis connection closed');

    logger.info('Shutdown complete');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
    // 1. Initialise environment
    const env = initWorkerEnv();
    setLogLevel(env.LOG_LEVEL);

    logger.info('RenderFlow render worker starting', {
        nodeEnv: env.NODE_ENV,
        healthPort: env.HEALTH_PORT,
        concurrency: env.WORKER_CONCURRENCY,
        jobTimeoutMs: env.JOB_TIMEOUT_MS,
    });

    // 2. Connect to Redis
    initRedis(env.REDIS_URL);
    logger.info('Redis connected');

    // 3. Create storage client
    const storage = createStorageClient(env);

    // 4. Start health check server
    await startHealthServer(env.HEALTH_PORT);

    // 5. Register workers
    _workers = registerWorkers(storage);

    // 6. Mark as ready
    setReady(true);
    logger.info('Worker ready — listening for jobs', {
        queues: [...QUEUE_NAMES],
    });

    // 7. Register shutdown handlers
    process.on('SIGTERM', () => {
        void shutdown().then(() => process.exit(0));
    });
    process.on('SIGINT', () => {
        void shutdown().then(() => process.exit(0));
    });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

main().catch((err) => {
    logger.fatal('Worker failed to start', {
        error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
});

// Export for testing
export { processJob, registerWorkers, shutdown, main };
