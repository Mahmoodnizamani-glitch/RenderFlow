/**
 * Environment configuration with Zod validation.
 *
 * Validates all required environment variables at startup and exports
 * a strongly-typed `env` object. Fails fast with a descriptive error
 * if any required variable is missing or invalid.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const EnvSchema = z.object({
    // Server
    PORT: z
        .string()
        .default('3001')
        .transform(Number)
        .pipe(z.number().int().positive().max(65535)),
    HOST: z.string().default('0.0.0.0'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
        .default('info'),

    // Database
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

    // Redis
    REDIS_URL: z.string().url().optional(),

    // Auth
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    // Cloudflare R2
    R2_ENDPOINT: z.string().url().optional(),
    R2_ACCESS_KEY: z.string().optional(),
    R2_SECRET_KEY: z.string().optional(),
    R2_BUCKET: z.string().default('renderflow-videos'),

    // CORS
    CORS_ORIGIN: z.string().default('*'),

    // Rate limiting
    RATE_LIMIT_MAX: z
        .string()
        .default('100')
        .transform(Number)
        .pipe(z.number().int().positive()),
    RATE_LIMIT_WINDOW_MS: z
        .string()
        .default('60000')
        .transform(Number)
        .pipe(z.number().int().positive()),

    // Payments / Webhooks
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    REVENUECAT_WEBHOOK_AUTH_KEY: z.string().optional(),

    // Observability
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ENVIRONMENT: z.string().optional(),
    POSTHOG_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse and validate environment variables from a raw record.
 * Throws a descriptive `Error` if validation fails.
 */
export function parseEnv(raw: Record<string, string | undefined>): Env {
    const result = EnvSchema.safeParse(raw);

    if (!result.success) {
        const details = result.error.issues
            .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');

        throw new Error(`Invalid environment configuration:\n${details}`);
    }

    return result.data;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _env: Env | null = null;

/**
 * Returns the validated environment. Must call `initEnv()` first.
 * Throws if called before `initEnv()`.
 */
export function getEnv(): Env {
    if (!_env) {
        throw new Error('Environment not initialised. Call initEnv() before getEnv().');
    }
    return _env;
}

/**
 * Initialise the environment singleton from `process.env`.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initEnv(): Env {
    if (_env) return _env;
    _env = parseEnv(process.env as Record<string, string | undefined>);
    return _env;
}

/**
 * Reset the environment singleton. **Test-only.**
 */
export function resetEnv(): void {
    _env = null;
}
