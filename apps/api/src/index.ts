/**
 * Server entry point.
 *
 * Validates the environment, initialises the database, runs migrations,
 * builds the Fastify app, mounts the WebSocket server, and starts listening.
 *
 * Registers graceful shutdown handlers for SIGTERM and SIGINT.
 */
import 'dotenv/config';

import { initEnv } from './config/env.js';
import { initDatabase, closeDatabase, getDatabase } from './db/connection.js';
import { initRedis, closeRedis } from './config/redis.js';
import { runMigrations } from './db/migrate.js';
import { buildApp } from './app.js';
import { initWebSocket, closeWebSocket, setJobOwnershipChecker, setNotificationRedis } from './ws/index.js';
import * as renderService from './services/render.service.js';
import { initSentry, closeSentry } from './config/sentry.js';
import { initPostHog, shutdownPostHog } from './config/posthog.js';

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function start(): Promise<void> {
    // 1. Validate environment
    let env;
    try {
        env = initEnv();
    } catch (err: unknown) {
        // eslint-disable-next-line no-console
        console.error('❌ Environment validation failed:', err instanceof Error ? err.message : err);
        process.exit(1);
    }

    // 2. Initialise database
    const db = initDatabase(env.DATABASE_URL);

    // 3. Run migrations
    try {
        await runMigrations(db);
        // eslint-disable-next-line no-console
        console.log('✅ Database migrations applied');
    } catch (err: unknown) {
        // eslint-disable-next-line no-console
        console.error('❌ Migration failed:', err instanceof Error ? err.message : err);
        process.exit(1);
    }

    // 3b. Initialise observability (non-blocking)
    await initSentry({
        dsn: env.SENTRY_DSN,
        environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
        release: `api@${process.env['npm_package_version'] ?? '0.0.1'}`,
    });
    await initPostHog(env.POSTHOG_API_KEY);

    // 4. Build app
    const app = await buildApp({ env });

    // 5. Initialise Redis (for BullMQ, notifications, and Socket.io adapter)
    if (env.REDIS_URL) {
        const redis = initRedis(env.REDIS_URL);
        setNotificationRedis(redis);
    }

    // 6. Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
        app.log.info(`Received ${signal}. Shutting down gracefully…`);
        try {
            await closeWebSocket();
            await app.close();
            await closeRedis();
            await closeDatabase();
            await closeSentry();
            await shutdownPostHog();
            app.log.info('Server shut down successfully');
            process.exit(0);
        } catch (err: unknown) {
            app.log.error(err, 'Error during shutdown');
            process.exit(1);
        }
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));

    // 7. Start listening
    try {
        await app.listen({ port: env.PORT, host: env.HOST });
        app.log.info(`RenderFlow API listening on ${env.HOST}:${env.PORT}`);
    } catch (err: unknown) {
        app.log.error(err, 'Failed to start server');
        process.exit(1);
    }

    // 8. Mount WebSocket server on the underlying HTTP server
    const httpServer = app.server;
    initWebSocket(httpServer, {
        jwtSecret: env.JWT_SECRET,
        corsOrigin: env.CORS_ORIGIN,
        redisUrl: env.REDIS_URL,
    });

    // 9. Wire job ownership checker for WS subscription validation
    setJobOwnershipChecker(async (jobId: string, userId: string): Promise<boolean> => {
        try {
            const db = getDatabase();
            const job = await renderService.getRenderJobByIdInternal(db, jobId);
            return job.userId === userId;
        } catch {
            return false;
        }
    });

    app.log.info('WebSocket server mounted on /renders namespace');
}

start();
