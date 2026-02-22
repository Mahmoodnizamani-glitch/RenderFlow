/**
 * Auth routes integration tests.
 *
 * Mocks the auth service layer — tests route handling, validation,
 * response shapes, and middleware behaviour without a real database.
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../app.js';
import type { Env } from '../../config/env.js';
import type { UserResponse } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Mock the database connection (required by health route + app boot)
// ---------------------------------------------------------------------------

vi.mock('../../db/connection.js', () => ({
    getSql: () => {
        return (strings: TemplateStringsArray) => {
            if (strings[0]?.includes('SELECT 1')) {
                return Promise.resolve([{ ok: 1 }]);
            }
            return Promise.resolve([]);
        };
    },
    getDatabase: vi.fn(() => ({})),
    initDatabase: vi.fn(),
    closeDatabase: vi.fn(),
    resetDatabase: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock the auth service
// ---------------------------------------------------------------------------

const mockUser: UserResponse = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: null,
    tier: 'free',
    renderCredits: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: null,
};

const mockTokenPair = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
};

const mockRegister = vi.fn();
const mockLogin = vi.fn();
const mockRefreshAccessToken = vi.fn();
const mockLogout = vi.fn();
const mockChangePassword = vi.fn();
const mockGetUserProfile = vi.fn();

vi.mock('../../services/auth.service.js', () => ({
    register: (...args: unknown[]) => mockRegister(...args),
    login: (...args: unknown[]) => mockLogin(...args),
    refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
    logout: (...args: unknown[]) => mockLogout(...args),
    changePassword: (...args: unknown[]) => mockChangePassword(...args),
    getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    generateTokenPair: vi.fn(),
    invalidateAllUserTokens: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import AppError after mocks
// ---------------------------------------------------------------------------

const { AppError } = await import('../../errors/errors.js');

// ---------------------------------------------------------------------------
// Test env
// ---------------------------------------------------------------------------

const testEnv: Env = {
    PORT: 0,
    HOST: '127.0.0.1',
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb',
    JWT_SECRET: 'test-jwt-secret-long-enough-32chars!!',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-long-enough',
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

beforeEach(() => {
    vi.clearAllMocks();

    // Default happy-path mocks
    mockRegister.mockResolvedValue({ user: mockUser, tokens: mockTokenPair });
    mockLogin.mockResolvedValue({ user: mockUser, tokens: mockTokenPair });
    mockRefreshAccessToken.mockResolvedValue({ user: mockUser, tokens: mockTokenPair });
    mockLogout.mockResolvedValue(undefined);
    mockChangePassword.mockResolvedValue(undefined);
    mockGetUserProfile.mockResolvedValue(mockUser);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getValidAccessToken(): string {
    return app.jwt.sign({ sub: mockUser.id }, { expiresIn: '15m' });
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/register', () => {
    it('registers a new user and returns 201 with tokens', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: 'test@example.com',
                password: 'password123',
                displayName: 'Test User',
            },
        });

        expect(res.statusCode).toBe(201);
        const body = res.json();
        expect(body.user).toEqual(mockUser);
        expect(body.accessToken).toBe('mock-access-token');
        expect(body.refreshToken).toBe('mock-refresh-token');
        expect(body.user.passwordHash).toBeUndefined();
    });

    it('normalizes email to lowercase', async () => {
        await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: 'TEST@Example.COM',
                password: 'password123',
                displayName: 'Test User',
            },
        });

        expect(mockRegister).toHaveBeenCalledWith(
            expect.anything(), // db
            'test@example.com',
            'password123',
            'Test User',
            expect.anything(), // jwt signer
        );
    });

    it('rejects duplicate email with 409', async () => {
        mockRegister.mockRejectedValue(
            AppError.conflict('A user with this email already exists'),
        );

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: 'dup@example.com',
                password: 'password123',
                displayName: 'Dup User',
            },
        });

        expect(res.statusCode).toBe(409);
        expect(res.json().error.code).toBe('CONFLICT');
    });

    it('rejects password shorter than 8 chars with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: 'test@example.com',
                password: 'short',
                displayName: 'Test User',
            },
        });

        expect(res.statusCode).toBe(400);
        expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid email with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: 'not-an-email',
                password: 'password123',
                displayName: 'Test User',
            },
        });

        expect(res.statusCode).toBe(400);
    });

    it('rejects missing displayName with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: 'test@example.com',
                password: 'password123',
            },
        });

        expect(res.statusCode).toBe(400);
    });

    it('rejects empty body with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {},
        });

        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/login', () => {
    it('logs in with correct credentials', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: {
                email: 'test@example.com',
                password: 'password123',
            },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.user).toEqual(mockUser);
        expect(body.accessToken).toBeTruthy();
        expect(body.refreshToken).toBeTruthy();
        expect(body.user.passwordHash).toBeUndefined();
    });

    it('rejects wrong email with 401', async () => {
        mockLogin.mockRejectedValue(
            AppError.unauthorized('Invalid email or password'),
        );

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: {
                email: 'wrong@example.com',
                password: 'password123',
            },
        });

        expect(res.statusCode).toBe(401);
        expect(res.json().error.code).toBe('UNAUTHORIZED');
    });

    it('rejects wrong password with 401', async () => {
        mockLogin.mockRejectedValue(
            AppError.unauthorized('Invalid email or password'),
        );

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: {
                email: 'test@example.com',
                password: 'wrongpassword',
            },
        });

        expect(res.statusCode).toBe(401);
        expect(res.json().error.code).toBe('UNAUTHORIZED');
    });
});

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/refresh', () => {
    it('refreshes tokens with a valid refresh token', async () => {
        const newTokenPair = {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
        };
        mockRefreshAccessToken.mockResolvedValue({
            user: mockUser,
            tokens: newTokenPair,
        });

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/refresh',
            payload: { refreshToken: 'old-refresh-token' },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.accessToken).toBe('new-access-token');
        expect(body.refreshToken).toBe('new-refresh-token');
    });

    it('rejects invalid refresh token with 401', async () => {
        mockRefreshAccessToken.mockRejectedValue(
            AppError.unauthorized('Invalid refresh token'),
        );

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/refresh',
            payload: { refreshToken: 'invalid-token' },
        });

        expect(res.statusCode).toBe(401);
        expect(res.json().error.code).toBe('UNAUTHORIZED');
    });

    it('rejects expired refresh token with 401', async () => {
        mockRefreshAccessToken.mockRejectedValue(
            AppError.unauthorized('Refresh token has expired'),
        );

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/refresh',
            payload: { refreshToken: 'expired-token' },
        });

        expect(res.statusCode).toBe(401);
        expect(res.json().error.message).toBe('Refresh token has expired');
    });

    it('rejects missing refreshToken in body with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/refresh',
            payload: {},
        });

        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/logout', () => {
    it('logs out with valid auth', async () => {
        const token = getValidAccessToken();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/logout',
            headers: { authorization: `Bearer ${token}` },
            payload: { refreshToken: 'some-refresh-token' },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().message).toBe('Logged out successfully');
        expect(mockLogout).toHaveBeenCalledWith(
            expect.anything(),
            'some-refresh-token',
        );
    });

    it('rejects without auth token with 401', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/logout',
            payload: { refreshToken: 'some-token' },
        });

        expect(res.statusCode).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// Change password
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/change-password', () => {
    it('changes password with valid auth and correct old password', async () => {
        const token = getValidAccessToken();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/change-password',
            headers: { authorization: `Bearer ${token}` },
            payload: {
                oldPassword: 'password123',
                newPassword: 'newpassword456',
            },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().message).toBe('Password changed successfully');
    });

    it('rejects wrong old password with 401', async () => {
        const token = getValidAccessToken();
        mockChangePassword.mockRejectedValue(
            AppError.unauthorized('Current password is incorrect'),
        );

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/change-password',
            headers: { authorization: `Bearer ${token}` },
            payload: {
                oldPassword: 'wrongOldPassword',
                newPassword: 'newpassword456',
            },
        });

        expect(res.statusCode).toBe(401);
        expect(res.json().error.code).toBe('UNAUTHORIZED');
    });

    it('rejects new password shorter than 8 chars with 400', async () => {
        const token = getValidAccessToken();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/change-password',
            headers: { authorization: `Bearer ${token}` },
            payload: {
                oldPassword: 'password123',
                newPassword: 'short',
            },
        });

        expect(res.statusCode).toBe(400);
    });

    it('rejects without auth with 401', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/change-password',
            payload: {
                oldPassword: 'password123',
                newPassword: 'newpassword456',
            },
        });

        expect(res.statusCode).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// Get current user
// ---------------------------------------------------------------------------

describe('GET /api/v1/auth/me', () => {
    it('returns the current user profile', async () => {
        const token = getValidAccessToken();

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/auth/me',
            headers: { authorization: `Bearer ${token}` },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.user).toEqual(mockUser);
        expect(body.user.passwordHash).toBeUndefined();
    });

    it('rejects without auth token with 401', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/auth/me',
        });

        expect(res.statusCode).toBe(401);
    });

    it('rejects malformed auth header with 401', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/auth/me',
            headers: { authorization: 'NotBearer something' },
        });

        expect(res.statusCode).toBe(401);
    });

    it('rejects invalid JWT with 401', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/auth/me',
            headers: { authorization: 'Bearer invalid.jwt.token' },
        });

        expect(res.statusCode).toBe(401);
    });

    it('rejects expired JWT with 401', async () => {
        // Sign a token with `exp` already in the past
        const pastExp = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
        const expired = app.jwt.sign({ sub: mockUser.id, exp: pastExp });

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/auth/me',
            headers: { authorization: `Bearer ${expired}` },
        });

        expect(res.statusCode).toBe(401);
        expect(res.json().error.message).toContain('expired');
    });
});
