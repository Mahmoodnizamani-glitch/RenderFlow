/**
 * Fastify application factory.
 *
 * Configures:
 * - Structured JSON logging (Pino) with request ID generation
 * - CORS, Helmet, and rate limiting plugins
 * - Global error handler mapping AppError → JSON responses
 * - Route registration under /api/v1
 */
import crypto from 'node:crypto';

import Fastify from 'fastify';
import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';
import { ZodError } from 'zod';

import type { Env } from './config/env.js';
import { captureException } from './config/sentry.js';
import { AppError } from './errors/errors.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.routes.js';
import { projectRoutes } from './routes/project.routes.js';
import { assetRoutes } from './routes/asset.routes.js';
import { renderRoutes } from './routes/render.routes.js';
import { webhookRoutes } from './routes/webhook.routes.js';
import { subscriptionRoutes } from './routes/subscription.routes.js';
import { userRoutes } from './routes/user.routes.js';

// ---------------------------------------------------------------------------
// Options type for testability
// ---------------------------------------------------------------------------

export interface BuildAppOptions {
    env: Env;
    /** Skip database-dependent setup (for unit tests). */
    skipDatabase?: boolean;
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
    const { env } = options;

    // ----- Fastify instance --------------------------------------------------

    const app = Fastify({
        logger: {
            level: env.LOG_LEVEL,
            ...(env.NODE_ENV === 'development'
                ? {
                    transport: {
                        target: 'pino-pretty',
                        options: {
                            translateTime: 'HH:MM:ss Z',
                            ignore: 'pid,hostname',
                        },
                    },
                }
                : {}),
            redact: {
                paths: [
                    'req.headers.authorization',
                    'req.headers.cookie',
                    'req.body.password',
                    'req.body.passwordHash',
                ],
                censor: '[REDACTED]',
            },
        },
        genReqId: () => crypto.randomUUID(),
        trustProxy: true,
        bodyLimit: 1_048_576, // 1 MB — file uploads bypass via multipart
    });

    // ----- Plugins -----------------------------------------------------------

    await app.register(cors, {
        origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
        credentials: true,
    });

    await app.register(helmet, {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'blob:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
            },
        },
        hsts: {
            maxAge: 31_536_000,
            includeSubDomains: true,
            preload: true,
        },
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    });

    // Redis-backed rate limiting when REDIS_URL is configured, otherwise in-memory
    const rateLimitStore = env.REDIS_URL
        ? {
            redis: new Redis(env.REDIS_URL, {
                connectTimeout: 500,
                maxRetriesPerRequest: 1,
                enableOfflineQueue: false,
            }),
        }
        : {};

    await app.register(rateLimit, {
        max: env.RATE_LIMIT_MAX,
        timeWindow: env.RATE_LIMIT_WINDOW_MS,
        ...rateLimitStore,
        addHeadersOnExceeding: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true, 'x-ratelimit-reset': true },
        addHeaders: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true, 'x-ratelimit-reset': true, 'retry-after': true },
    });

    await app.register(jwt, {
        secret: env.JWT_SECRET,
    });

    await app.register(multipart, {
        limits: {
            fileSize: 50 * 1024 * 1024, // 50 MB
            files: 1,
        },
    });

    // ----- Request logging ---------------------------------------------------

    app.addHook('onResponse', (request, reply, done) => {
        request.log.info(
            {
                method: request.method,
                url: request.url,
                statusCode: reply.statusCode,
                responseTime: reply.elapsedTime,
            },
            'request completed',
        );
        done();
    });

    // ----- Global error handler ----------------------------------------------

    app.setErrorHandler(
        (error: FastifyError | AppError | ZodError | Error, request: FastifyRequest, reply: FastifyReply) => {
            const requestId = request.id;

            // AppError — known application errors
            if (AppError.is(error)) {
                request.log.warn(
                    { errorCode: error.code, statusCode: error.statusCode, requestId },
                    error.message,
                );
                return reply.status(error.statusCode).send({
                    ...error.toJSON(),
                    requestId,
                });
            }

            // Zod validation errors
            if (error instanceof ZodError) {
                const details = error.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                }));

                request.log.warn({ validationErrors: details, requestId }, 'Validation failed');

                return reply.status(400).send({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Request validation failed',
                        details,
                    },
                    requestId,
                });
            }

            // Fastify validation errors (JSON Schema)
            if ('validation' in error && error.validation) {
                request.log.warn({ validation: error.validation, requestId }, 'Schema validation failed');
                return reply.status(400).send({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: error.message,
                        details: error.validation,
                    },
                    requestId,
                });
            }

            // Rate limit errors
            if ('statusCode' in error && error.statusCode === 429) {
                return reply.status(429).send({
                    error: {
                        code: 'RATE_LIMITED',
                        message: 'Too many requests. Please try again later.',
                    },
                    requestId,
                });
            }

            // Unexpected errors — log full stack, report to Sentry, return generic message
            request.log.error({ err: error, requestId }, 'Unhandled error');
            captureException(error, { requestId, url: request.url, method: request.method });
            return reply.status(500).send({
                error: {
                    code: 'INTERNAL',
                    message: 'Internal server error',
                },
                requestId,
            });
        },
    );

    // ----- Routes ------------------------------------------------------------

    await app.register(
        async (apiV1) => {
            await apiV1.register(healthRoutes);
            await apiV1.register(authRoutes);
            await apiV1.register(projectRoutes);
            await apiV1.register(assetRoutes);
            await apiV1.register(renderRoutes);
            await apiV1.register(webhookRoutes);
            await apiV1.register(subscriptionRoutes);
            await apiV1.register(userRoutes);
        },
        { prefix: '/api/v1' },
    );

    return app;
}
