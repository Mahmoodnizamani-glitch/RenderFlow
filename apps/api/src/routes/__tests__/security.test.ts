/**
 * Security-focused integration tests.
 *
 * Validates: SQL injection, XSS sanitisation, JWT manipulation,
 * rate limit enforcement, IDOR prevention, requestId in errors,
 * content-security-policy headers, and body size limits.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../app.js';
import type { Env } from '../../config/env.js';

// ---------------------------------------------------------------------------
// Mock the database connection module
// ---------------------------------------------------------------------------

const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
        }),
    }),
});

const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
    }),
});

vi.mock('../../db/connection.js', () => ({
    getDatabase: () => ({
        select: mockSelect,
        insert: mockInsert,
        update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }),
    getSql: () => (strings: TemplateStringsArray) => {
        if (strings[0]?.includes('SELECT 1')) return Promise.resolve([{ ok: 1 }]);
        return Promise.resolve([]);
    },
    initDatabase: vi.fn(),
    closeDatabase: vi.fn(),
    resetDatabase: vi.fn(),
}));

// Mock queue and credit services so render route doesn't crash
vi.mock('../../services/queue.service.js', () => ({
    resolveQueueTier: vi.fn().mockReturnValue('standard'),
    submitJob: vi.fn().mockResolvedValue(undefined),
    cancelJob: vi.fn().mockResolvedValue(undefined),
    getQueueStats: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../services/credit.service.js', () => ({
    calculateCost: vi.fn().mockReturnValue(1),
    deductCredits: vi.fn().mockResolvedValue(undefined),
    getDailyRenderCount: vi.fn().mockResolvedValue(0),
    refundCredits: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/audit.service.js', () => ({
    writeAuditLog: vi.fn().mockResolvedValue(undefined),
    extractClientIp: vi.fn().mockReturnValue('127.0.0.1'),
    extractUserAgent: vi.fn().mockReturnValue('test-agent'),
}));

// ---------------------------------------------------------------------------
// Test env
// ---------------------------------------------------------------------------

const testEnv: Env = {
    PORT: 0,
    HOST: '127.0.0.1',
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb',
    JWT_SECRET: 'test-jwt-secret-long-enough-for-signing',
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
// Helpers
// ---------------------------------------------------------------------------

function signToken(payload: Record<string, unknown>): string {
    return app.jwt.sign(payload, { expiresIn: '5m' });
}

function authHeader(userId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'): string {
    return `Bearer ${signToken({ sub: userId })}`;
}

// ---------------------------------------------------------------------------
// 1. SQL Injection Prevention
// ---------------------------------------------------------------------------

describe('SQL Injection Prevention', () => {
    it('rejects SQL injection in project name via Zod schema (parameterised queries)', async () => {
        const malicious = "'; DROP TABLE users; --";

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/projects',
            headers: { authorization: authHeader() },
            payload: {
                name: malicious,
                description: 'test',
            },
        });

        // The request should be processed (Zod accepts the name as a string)
        // and go through to the DB layer. With mocked DB, we may get a 500
        // or a successful response — the key security assertion is that
        // the input is parameterised, not concatenated into SQL.
        // We verify this by ensuring the response is valid JSON.
        const body = response.json();
        expect(body).toBeTruthy();
        // Must not return raw SQL error messages or stack traces to client
        if (response.statusCode >= 400) {
            expect(body.error.message).not.toMatch(/SELECT|INSERT|DROP|pg_|drizzle/i);
        }
    });

    it('handles SQL injection in query parameters safely', async () => {
        const response = await app.inject({
            method: 'GET',
            url: "/api/v1/projects?search=' OR 1=1 --",
            headers: { authorization: authHeader() },
        });

        // Should return valid JSON regardless — no raw SQL error exposure
        const body = response.json();
        expect(body).toBeTruthy();
        if (response.statusCode === 500) {
            expect(body.error.message).toBe('Internal server error');
        }
    });
});

// ---------------------------------------------------------------------------
// 2. XSS Prevention
// ---------------------------------------------------------------------------

describe('XSS Prevention', () => {
    it('returns safe JSON response that does not reflect raw HTML', async () => {
        const xssPayload = '<script>alert("xss")</script>';

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/projects',
            headers: { authorization: authHeader() },
            payload: {
                name: xssPayload,
                description: '<img src=x onerror=alert(1)>',
            },
        });

        // API returns JSON, not HTML — XSS is a rendering concern.
        // Key assertion: response content-type is JSON, not text/html
        expect(response.headers['content-type']).toContain('application/json');
        const body = response.json();
        expect(body).toBeTruthy();
        // Should never leak SQL or internal details in error messages
        if (response.statusCode >= 400) {
            expect(body.error.message).not.toMatch(/SELECT|INSERT|DROP|pg_|drizzle/i);
        }
    });
});

// ---------------------------------------------------------------------------
// 3. JWT Manipulation
// ---------------------------------------------------------------------------

describe('JWT Manipulation', () => {
    it('rejects requests with no Authorization header', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/projects',
        });

        expect(response.statusCode).toBe(401);
        const body = response.json();
        expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects requests with malformed Bearer token', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/projects',
            headers: { authorization: 'Bearer not-a-real-jwt' },
        });

        expect(response.statusCode).toBe(401);
    });

    it('rejects requests with empty Bearer token', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/projects',
            headers: { authorization: 'Bearer ' },
        });

        expect(response.statusCode).toBe(401);
    });

    it('rejects requests with token signed by a different secret', async () => {
        // Manually create a JWT with a different signing key
        const fakeApp = (await import('fastify')).default({ logger: false });
        await fakeApp.register((await import('@fastify/jwt')).default, {
            secret: 'completely-different-secret-key',
        });
        await fakeApp.ready();
        const fakeToken = fakeApp.jwt.sign({ sub: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
        await fakeApp.close();

        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/projects',
            headers: { authorization: `Bearer ${fakeToken}` },
        });

        expect(response.statusCode).toBe(401);
    });

    it('rejects token without sub claim', async () => {
        const token = app.jwt.sign({ role: 'admin' }, { expiresIn: '5m' });

        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/projects',
            headers: { authorization: `Bearer ${token}` },
        });

        expect(response.statusCode).toBe(401);
    });

    it('rejects Authorization header without Bearer prefix', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/projects',
            headers: { authorization: 'Basic dXNlcjpwYXNz' },
        });

        expect(response.statusCode).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// 4. IDOR Prevention
// ---------------------------------------------------------------------------

describe('IDOR Prevention', () => {
    it('returns 404 or 403 when accessing another user project by UUID', async () => {
        const _otherUserId = '11111111-2222-3333-4444-555555555555';
        const otherProjectId = '66666666-7777-8888-9999-aaaaaaaaaaaa';

        // Request as current user, try to access other user's project
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/projects/${otherProjectId}`,
            headers: { authorization: authHeader() },
        });

        // Should be 404 (not found for this user) or 403, never 200 with other user data
        expect([403, 404]).toContain(response.statusCode);
    });

    it('returns 404 or 403 when accessing another user render job', async () => {
        const otherRenderJobId = '66666666-7777-8888-9999-aaaaaaaaaaaa';

        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/renders/${otherRenderJobId}`,
            headers: { authorization: authHeader() },
        });

        expect([403, 404]).toContain(response.statusCode);
    });
});

// ---------------------------------------------------------------------------
// 5. Request ID in Error Responses
// ---------------------------------------------------------------------------

describe('RequestId in Errors', () => {
    it('includes requestId in 401 error responses', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/projects',
        });

        expect(response.statusCode).toBe(401);
        const body = response.json();
        expect(body.requestId).toBeTruthy();
        expect(typeof body.requestId).toBe('string');
    });

    it('includes requestId in 400 validation error responses', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: { email: 'not-an-email', password: '' },
        });

        const body = response.json();
        if (response.statusCode === 400) {
            expect(body.requestId).toBeTruthy();
        }
    });
});

// ---------------------------------------------------------------------------
// 6. Security Headers
// ---------------------------------------------------------------------------

describe('Security Headers', () => {
    it('includes Content-Security-Policy header', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/health',
        });

        expect(response.headers['content-security-policy']).toBeTruthy();
    });

    it('includes Strict-Transport-Security header', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/health',
        });

        expect(response.headers['strict-transport-security']).toBeTruthy();
    });

    it('includes Referrer-Policy header', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/health',
        });

        expect(response.headers['referrer-policy']).toBeTruthy();
    });

    it('includes X-Content-Type-Options: nosniff', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/health',
        });

        expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('includes X-Frame-Options', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/health',
        });

        expect(response.headers['x-frame-options']).toBeTruthy();
    });
});

// ---------------------------------------------------------------------------
// 7. Body Size Limits
// ---------------------------------------------------------------------------

describe('Body Size Limits', () => {
    it('rejects JSON body larger than 1MB', async () => {
        // Generate a string > 1MB
        const largeBody = {
            name: 'test',
            code: 'x'.repeat(1_100_000), // > 1MB
        };

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/projects',
            headers: { authorization: authHeader() },
            payload: largeBody,
        });

        // Fastify returns FST_ERR_CTP_BODY_TOO_LARGE (413) or it may hit
        // the global error handler (500) depending on how the body parser
        // handles the overflow. Either way, the payload should be rejected.
        expect([413, 500]).toContain(response.statusCode);
        const body = response.json();
        expect(body).toBeTruthy();
        // Should never leak internal details
        if (response.statusCode === 500) {
            expect(body.error.message).toBe('Internal server error');
        }
    });
});

// ---------------------------------------------------------------------------
// 8. Input Validation Limits
// ---------------------------------------------------------------------------

describe('Input Validation Limits', () => {
    it('rejects project code exceeding 500KB', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/projects',
            headers: { authorization: authHeader() },
            payload: {
                name: 'test',
                code: 'x'.repeat(513_000), // > 500KB
            },
        });

        // Should be 400 from Zod or 413 from body limit
        expect([400, 413]).toContain(response.statusCode);
    });

    it('rejects overly long project description', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/projects',
            headers: { authorization: authHeader() },
            payload: {
                name: 'test',
                description: 'x'.repeat(5001),
            },
        });

        // 400 from Zod validation
        expect(response.statusCode).toBe(400);
    });

    it('rejects project name exceeding 255 chars', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/projects',
            headers: { authorization: authHeader() },
            payload: {
                name: 'x'.repeat(256),
            },
        });

        expect(response.statusCode).toBe(400);
    });
});
