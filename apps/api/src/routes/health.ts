/**
 * Health-check and readiness route plugins.
 *
 * GET /api/v1/health  — Liveness probe (fast, no dependency checks)
 * GET /api/v1/ready   — Readiness probe (checks DB, Redis, R2)
 *
 * Liveness tells the orchestrator the process is alive.
 * Readiness tells it the process can serve traffic.
 */
import type { FastifyInstance } from 'fastify';

import { getSql } from '../db/connection.js';

// ---------------------------------------------------------------------------
// Liveness probe
// ---------------------------------------------------------------------------

export async function healthRoutes(app: FastifyInstance): Promise<void> {
    app.get(
        '/health',
        {
            schema: {
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            status: { type: 'string' },
                            timestamp: { type: 'string' },
                            version: { type: 'string' },
                            uptime: { type: 'number' },
                        },
                    },
                },
            },
        },
        async (_request, _reply) => {
            return {
                status: 'ok',
                timestamp: new Date().toISOString(),
                version: process.env['npm_package_version'] ?? '0.0.1',
                uptime: process.uptime(),
            };
        },
    );

    // -------------------------------------------------------------------
    // Readiness probe
    // -------------------------------------------------------------------

    app.get(
        '/ready',
        {
            schema: {
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            status: { type: 'string' },
                            db: { type: 'string' },
                            redis: { type: 'string' },
                            r2: { type: 'string' },
                        },
                    },
                    503: {
                        type: 'object',
                        properties: {
                            status: { type: 'string' },
                            db: { type: 'string' },
                            redis: { type: 'string' },
                            r2: { type: 'string' },
                        },
                    },
                },
            },
        },
        async (_request, reply) => {
            const checks = await runReadinessChecks();

            const allHealthy = checks.db === 'connected' &&
                checks.redis === 'connected' &&
                checks.r2 === 'accessible';

            const statusCode = allHealthy ? 200 : 503;

            return reply.status(statusCode).send({
                status: allHealthy ? 'ready' : 'not_ready',
                ...checks,
            });
        },
    );
}

// ---------------------------------------------------------------------------
// Readiness check helpers
// ---------------------------------------------------------------------------

interface ReadinessResult {
    db: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
    r2: 'accessible' | 'inaccessible';
}

async function runReadinessChecks(): Promise<ReadinessResult> {
    const [db, redis, r2] = await Promise.allSettled([
        checkDatabase(),
        checkRedis(),
        checkR2(),
    ]);

    return {
        db: db.status === 'fulfilled' && db.value ? 'connected' : 'disconnected',
        redis: redis.status === 'fulfilled' && redis.value ? 'connected' : 'disconnected',
        r2: r2.status === 'fulfilled' && r2.value ? 'accessible' : 'inaccessible',
    };
}

async function checkDatabase(): Promise<boolean> {
    const sql = getSql();
    const result = await Promise.race([
        sql`SELECT 1 as ok`,
        rejectAfter(3000, 'DB health check timed out'),
    ]);
    return Boolean(result);
}

async function checkRedis(): Promise<boolean> {
    try {
        // Dynamic import to avoid crash if redis module not initialised
        const { getRedis } = await import('../config/redis.js');
        const redis = getRedis();
        const pong = await Promise.race([
            redis.ping(),
            rejectAfter(2000, 'Redis health check timed out'),
        ]);
        return pong === 'PONG';
    } catch {
        // Redis not configured or not initialised — treat as not available
        return false;
    }
}

async function checkR2(): Promise<boolean> {
    // R2 availability is inferred from env configuration presence.
    // Actual connectivity is validated by upload/download operations.
    // A full HeadBucket call on every readiness check would add latency
    // and R2 rate-limit pressure.
    const hasR2Config = Boolean(
        process.env['R2_ENDPOINT'] &&
        process.env['R2_ACCESS_KEY'] &&
        process.env['R2_SECRET_KEY'],
    );
    return hasR2Config;
}

function rejectAfter(ms: number, message: string): Promise<never> {
    return new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(message)), ms),
    );
}
