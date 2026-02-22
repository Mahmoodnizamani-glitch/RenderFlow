/**
 * Health route integration tests.
 *
 * Uses `app.inject()` to test without starting a real server.
 * Mocks the database connection for unit-testable health checks.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../app.js';
import type { Env } from '../../config/env.js';

// ---------------------------------------------------------------------------
// Mock the database connection module
// ---------------------------------------------------------------------------

vi.mock('../../db/connection.js', () => {
    let shouldFail = false;

    return {
        getSql: () => {
            if (shouldFail) throw new Error('DB not available');

            // Return a tagged template function that simulates postgres.js
            return (strings: TemplateStringsArray, ..._values: unknown[]) => {
                if (strings[0]?.includes('SELECT 1')) {
                    return Promise.resolve([{ ok: 1 }]);
                }
                return Promise.resolve([]);
            };
        },
        initDatabase: vi.fn(),
        closeDatabase: vi.fn(),
        resetDatabase: vi.fn(),
        // Exposed for tests to toggle failure mode
        __setFailMode: (fail: boolean) => {
            shouldFail = fail;
        },
    };
});

// ---------------------------------------------------------------------------
// Test env (minimal valid config for app factory)
// ---------------------------------------------------------------------------

const testEnv: Env = {
    PORT: 0,
    HOST: '127.0.0.1',
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb',
    JWT_SECRET: 'test-jwt-secret-long-enough',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-long',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    CORS_ORIGIN: '*',
    RATE_LIMIT_MAX: 1000,
    RATE_LIMIT_WINDOW_MS: 60000,
    R2_BUCKET: 'test-bucket',
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let app: FastifyInstance;

beforeAll(async () => {
    app = await buildApp({ env: testEnv, skipDatabase: true });
    await app.ready();
});

afterAll(async () => {
    await app.close();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/health', () => {
    it('returns 200 with status ok', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/health',
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();
        expect(body.status).toBe('ok');
    });

    it('includes a valid ISO timestamp', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/health',
        });

        const body = response.json();
        expect(body.timestamp).toBeTruthy();
        expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });

    it('includes version string', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/health',
        });

        const body = response.json();
        expect(typeof body.version).toBe('string');
    });

    it('includes uptime as a number', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/health',
        });

        const body = response.json();
        expect(typeof body.uptime).toBe('number');
        expect(body.uptime).toBeGreaterThan(0);
    });

    it('does not include db status (liveness only)', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/health',
        });

        const body = response.json();
        expect(body.db).toBeUndefined();
    });
});

describe('GET /api/v1/ready', () => {
    it('returns readiness status with dependency checks', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/ready',
        });

        const body = response.json();
        expect(body.db).toBeDefined();
        expect(body.redis).toBeDefined();
        expect(body.r2).toBeDefined();
    });

    it('reports db as connected when SQL succeeds', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/ready',
        });

        const body = response.json();
        expect(body.db).toBe('connected');
    });

    it('reports db as disconnected when SQL fails', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { __setFailMode } = await import('../../db/connection.js') as any;
        __setFailMode(true);

        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/ready',
        });

        const body = response.json();
        expect(body.db).toBe('disconnected');

        // Restore
        __setFailMode(false);
    });
});

describe('Error handling', () => {
    it('returns 404 JSON for unknown routes', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/nonexistent',
        });

        expect(response.statusCode).toBe(404);
    });

    it('returns consistent error JSON structure for 404', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/nonexistent',
        });

        const body = response.json();
        // Fastify returns its own 404 structure; we're verifying it returns JSON
        expect(typeof body.message).toBe('string');
    });
});

describe('CORS headers', () => {
    it('includes access-control-allow-origin header', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/health',
            headers: {
                origin: 'http://localhost:3000',
            },
        });

        expect(response.headers['access-control-allow-origin']).toBeTruthy();
    });
});

describe('Security headers', () => {
    it('includes helmet security headers', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/health',
        });

        // Helmet adds these headers
        expect(response.headers['x-dns-prefetch-control']).toBeTruthy();
        expect(response.headers['x-frame-options']).toBeTruthy();
        expect(response.headers['x-content-type-options']).toBeTruthy();
    });
});
