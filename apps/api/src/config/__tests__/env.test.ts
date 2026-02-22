/**
 * Tests for environment config parsing.
 */
import { describe, it, expect } from 'vitest';
import { parseEnv } from '../env.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validEnv(overrides: Record<string, string> = {}): Record<string, string> {
    return {
        DATABASE_URL: 'postgresql://u:p@localhost:5432/renderflow',
        JWT_SECRET: 'test-secret-long-enough',
        JWT_REFRESH_SECRET: 'test-refresh-secret-long',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseEnv', () => {
    it('parses a valid minimal config', () => {
        const env = parseEnv(validEnv());

        expect(env.PORT).toBe(3001);
        expect(env.HOST).toBe('0.0.0.0');
        expect(env.NODE_ENV).toBe('development');
        expect(env.LOG_LEVEL).toBe('info');
        expect(env.DATABASE_URL).toBe('postgresql://u:p@localhost:5432/renderflow');
        expect(env.JWT_SECRET).toBe('test-secret-long-enough');
        expect(env.CORS_ORIGIN).toBe('*');
        expect(env.RATE_LIMIT_MAX).toBe(100);
        expect(env.RATE_LIMIT_WINDOW_MS).toBe(60000);
    });

    it('applies custom port', () => {
        const env = parseEnv(validEnv({ PORT: '8080' }));
        expect(env.PORT).toBe(8080);
    });

    it('applies custom NODE_ENV', () => {
        const env = parseEnv(validEnv({ NODE_ENV: 'production' }));
        expect(env.NODE_ENV).toBe('production');
    });

    it('applies custom rate limit', () => {
        const env = parseEnv(validEnv({ RATE_LIMIT_MAX: '200', RATE_LIMIT_WINDOW_MS: '30000' }));
        expect(env.RATE_LIMIT_MAX).toBe(200);
        expect(env.RATE_LIMIT_WINDOW_MS).toBe(30000);
    });

    it('throws when DATABASE_URL is missing', () => {
        const raw = validEnv();
        delete (raw as Record<string, string | undefined>)['DATABASE_URL'];
        expect(() => parseEnv(raw)).toThrow('Invalid environment configuration');
    });

    it('throws when DATABASE_URL is not a valid URL', () => {
        expect(() => parseEnv(validEnv({ DATABASE_URL: 'not-a-url' }))).toThrow(
            'Invalid environment configuration',
        );
    });

    it('throws when JWT_SECRET is too short', () => {
        expect(() => parseEnv(validEnv({ JWT_SECRET: 'short' }))).toThrow(
            'JWT_SECRET must be at least 16 characters',
        );
    });

    it('throws when JWT_REFRESH_SECRET is too short', () => {
        expect(() => parseEnv(validEnv({ JWT_REFRESH_SECRET: 'short' }))).toThrow(
            'JWT_REFRESH_SECRET must be at least 16 characters',
        );
    });

    it('throws when NODE_ENV is invalid', () => {
        expect(() => parseEnv(validEnv({ NODE_ENV: 'staging' }))).toThrow(
            'Invalid environment configuration',
        );
    });

    it('throws when PORT is out of range', () => {
        expect(() => parseEnv(validEnv({ PORT: '99999' }))).toThrow(
            'Invalid environment configuration',
        );
    });

    it('sets optional R2 fields to undefined when missing', () => {
        const env = parseEnv(validEnv());
        expect(env.R2_ENDPOINT).toBeUndefined();
        expect(env.R2_ACCESS_KEY).toBeUndefined();
        expect(env.R2_SECRET_KEY).toBeUndefined();
    });

    it('sets REDIS_URL to undefined when missing', () => {
        const env = parseEnv(validEnv());
        expect(env.REDIS_URL).toBeUndefined();
    });

    it('parses R2 config when provided', () => {
        const env = parseEnv(
            validEnv({
                R2_ENDPOINT: 'https://r2.example.com',
                R2_ACCESS_KEY: 'key123',
                R2_SECRET_KEY: 'secret456',
                R2_BUCKET: 'my-bucket',
            }),
        );
        expect(env.R2_ENDPOINT).toBe('https://r2.example.com');
        expect(env.R2_ACCESS_KEY).toBe('key123');
        expect(env.R2_SECRET_KEY).toBe('secret456');
        expect(env.R2_BUCKET).toBe('my-bucket');
    });
});
