/**
 * Worker environment configuration with Zod validation.
 *
 * Validates all required environment variables at startup.
 * Fails fast with descriptive errors if any are missing or invalid.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const WorkerEnvSchema = z.object({
    // Redis
    REDIS_URL: z
        .string()
        .url('REDIS_URL must be a valid Redis connection string')
        .default('redis://localhost:6379'),

    // Cloudflare R2
    R2_ENDPOINT: z.string().url('R2_ENDPOINT must be a valid URL'),
    R2_ACCESS_KEY: z.string().min(1, 'R2_ACCESS_KEY is required'),
    R2_SECRET_KEY: z.string().min(1, 'R2_SECRET_KEY is required'),
    R2_BUCKET: z.string().default('renderflow-videos'),

    // Health check
    HEALTH_PORT: z
        .string()
        .default('3001')
        .transform(Number)
        .pipe(z.number().int().positive().max(65535)),

    // Runtime
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
        .default('info'),

    // Job settings
    JOB_TIMEOUT_MS: z
        .string()
        .default('1800000') // 30 minutes
        .transform(Number)
        .pipe(z.number().int().positive()),
    WORKER_CONCURRENCY: z
        .string()
        .default('1')
        .transform(Number)
        .pipe(z.number().int().positive().max(4)),
});

export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse and validate environment variables from a raw record.
 * Throws a descriptive `Error` if validation fails.
 */
export function parseWorkerEnv(raw: Record<string, string | undefined>): WorkerEnv {
    const result = WorkerEnvSchema.safeParse(raw);

    if (!result.success) {
        const details = result.error.issues
            .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');

        throw new Error(`Invalid worker environment configuration:\n${details}`);
    }

    return result.data;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _env: WorkerEnv | null = null;

/**
 * Returns the validated environment. Must call `initWorkerEnv()` first.
 */
export function getWorkerEnv(): WorkerEnv {
    if (!_env) {
        throw new Error('Worker environment not initialised. Call initWorkerEnv() first.');
    }
    return _env;
}

/**
 * Initialise the environment singleton from `process.env`.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initWorkerEnv(): WorkerEnv {
    if (_env) return _env;
    _env = parseWorkerEnv(process.env as Record<string, string | undefined>);
    return _env;
}

/**
 * Reset the environment singleton. **Test-only.**
 */
export function resetWorkerEnv(): void {
    _env = null;
}
