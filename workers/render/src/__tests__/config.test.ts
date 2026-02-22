/**
 * Unit tests for the worker environment configuration.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { parseWorkerEnv, resetWorkerEnv } from '../config/env.js';

describe('Worker Environment Config', () => {
    afterEach(() => {
        resetWorkerEnv();
    });

    // -------------------------------------------------------------------
    // Valid configs
    // -------------------------------------------------------------------

    it('parses a complete valid environment', () => {
        const env = parseWorkerEnv({
            REDIS_URL: 'redis://localhost:6379',
            R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
            R2_ACCESS_KEY: 'test-key',
            R2_SECRET_KEY: 'test-secret',
            R2_BUCKET: 'test-bucket',
            HEALTH_PORT: '4000',
            NODE_ENV: 'test',
            LOG_LEVEL: 'debug',
            JOB_TIMEOUT_MS: '60000',
            WORKER_CONCURRENCY: '2',
        });

        expect(env.REDIS_URL).toBe('redis://localhost:6379');
        expect(env.R2_ENDPOINT).toBe('https://account.r2.cloudflarestorage.com');
        expect(env.R2_ACCESS_KEY).toBe('test-key');
        expect(env.R2_SECRET_KEY).toBe('test-secret');
        expect(env.R2_BUCKET).toBe('test-bucket');
        expect(env.HEALTH_PORT).toBe(4000);
        expect(env.NODE_ENV).toBe('test');
        expect(env.LOG_LEVEL).toBe('debug');
        expect(env.JOB_TIMEOUT_MS).toBe(60000);
        expect(env.WORKER_CONCURRENCY).toBe(2);
    });

    it('applies defaults for optional fields', () => {
        const env = parseWorkerEnv({
            R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
            R2_ACCESS_KEY: 'key',
            R2_SECRET_KEY: 'secret',
        });

        expect(env.REDIS_URL).toBe('redis://localhost:6379');
        expect(env.R2_BUCKET).toBe('renderflow-videos');
        expect(env.HEALTH_PORT).toBe(3001);
        expect(env.NODE_ENV).toBe('development');
        expect(env.LOG_LEVEL).toBe('info');
        expect(env.JOB_TIMEOUT_MS).toBe(1800000);
        expect(env.WORKER_CONCURRENCY).toBe(1);
    });

    // -------------------------------------------------------------------
    // Validation errors
    // -------------------------------------------------------------------

    it('throws for missing R2_ENDPOINT', () => {
        expect(() =>
            parseWorkerEnv({
                R2_ACCESS_KEY: 'key',
                R2_SECRET_KEY: 'secret',
            }),
        ).toThrow('Invalid worker environment');
    });

    it('throws for missing R2_ACCESS_KEY', () => {
        expect(() =>
            parseWorkerEnv({
                R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
                R2_SECRET_KEY: 'secret',
            }),
        ).toThrow('Invalid worker environment');
    });

    it('throws for missing R2_SECRET_KEY', () => {
        expect(() =>
            parseWorkerEnv({
                R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
                R2_ACCESS_KEY: 'key',
            }),
        ).toThrow('Invalid worker environment');
    });

    it('throws for invalid R2_ENDPOINT URL', () => {
        expect(() =>
            parseWorkerEnv({
                R2_ENDPOINT: 'not-a-url',
                R2_ACCESS_KEY: 'key',
                R2_SECRET_KEY: 'secret',
            }),
        ).toThrow('Invalid worker environment');
    });

    it('throws for invalid HEALTH_PORT', () => {
        expect(() =>
            parseWorkerEnv({
                R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
                R2_ACCESS_KEY: 'key',
                R2_SECRET_KEY: 'secret',
                HEALTH_PORT: '99999',
            }),
        ).toThrow('Invalid worker environment');
    });

    it('throws for invalid NODE_ENV', () => {
        expect(() =>
            parseWorkerEnv({
                R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
                R2_ACCESS_KEY: 'key',
                R2_SECRET_KEY: 'secret',
                NODE_ENV: 'staging',
            }),
        ).toThrow('Invalid worker environment');
    });

    it('throws for invalid WORKER_CONCURRENCY (too high)', () => {
        expect(() =>
            parseWorkerEnv({
                R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
                R2_ACCESS_KEY: 'key',
                R2_SECRET_KEY: 'secret',
                WORKER_CONCURRENCY: '10',
            }),
        ).toThrow('Invalid worker environment');
    });
});
