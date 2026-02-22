/**
 * Asset routes integration tests.
 *
 * Mocks the asset service and storage service layers.
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../app.js';
import type { Env } from '../../config/env.js';

// ---------------------------------------------------------------------------
// Mock DB connection
// ---------------------------------------------------------------------------

vi.mock('../../db/connection.js', () => ({
    getSql: () => (strings: TemplateStringsArray) => {
        if (strings[0]?.includes('SELECT 1')) return Promise.resolve([{ ok: 1 }]);
        return Promise.resolve([]);
    },
    getDatabase: vi.fn(() => ({})),
    initDatabase: vi.fn(),
    closeDatabase: vi.fn(),
    resetDatabase: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock env singleton
// ---------------------------------------------------------------------------

vi.mock('../../config/env.js', async () => {
    const actual = await vi.importActual('../../config/env.js');
    return {
        ...actual,
        getEnv: () => ({
            R2_ENDPOINT: undefined,
            R2_ACCESS_KEY: undefined,
            R2_SECRET_KEY: undefined,
            R2_BUCKET: 'test-bucket',
        }),
    };
});

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockAsset = {
    id: '660e8400-e29b-41d4-a716-446655440099',
    userId: 'user-uuid-1234',
    projectId: '550e8400-e29b-41d4-a716-446655440000',
    name: 'test.png',
    type: 'image',
    mimeType: 'image/png',
    fileSize: 1024,
    storagePath: 'users/user-uuid-1234/assets/asset-uuid-1234/test.png',
    cdnUrl: 'https://r2-placeholder.dev/test.png',
    metadata: {},
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const mockCreateAssetFromUpload = vi.fn();
const mockListProjectAssets = vi.fn();
const mockDeleteAsset = vi.fn();
const mockGenerateAssetPresignedUrl = vi.fn();

vi.mock('../../services/asset.service.js', () => ({
    createAssetFromUpload: (...args: unknown[]) => mockCreateAssetFromUpload(...args),
    listProjectAssets: (...args: unknown[]) => mockListProjectAssets(...args),
    deleteAsset: (...args: unknown[]) => mockDeleteAsset(...args),
    generateAssetPresignedUrl: (...args: unknown[]) => mockGenerateAssetPresignedUrl(...args),
}));

vi.mock('../../services/storage.service.js', () => ({
    initStorage: vi.fn(() => ({
        uploadFile: vi.fn().mockResolvedValue('https://r2-placeholder.dev/test.png'),
        deleteFile: vi.fn().mockResolvedValue(undefined),
        generatePresignedUploadUrl: vi.fn().mockResolvedValue('https://r2-placeholder.dev/presigned/test.png'),
        getPublicUrl: vi.fn().mockReturnValue('https://r2-placeholder.dev/test.png'),
    })),
    buildAssetStoragePath: vi.fn(),
    resetStorage: vi.fn(),
}));

// Mock project service too (used by project routes registered in same app)
vi.mock('../../services/project.service.js', () => ({
    createProject: vi.fn(),
    getProjectById: vi.fn(),
    listProjects: vi.fn().mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasMore: false } }),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    duplicateProject: vi.fn(),
}));

// Mock auth service (used by auth routes)
vi.mock('../../services/auth.service.js', () => ({
    register: vi.fn(),
    login: vi.fn(),
    refreshAccessToken: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    getUserProfile: vi.fn(),
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    generateTokenPair: vi.fn(),
    invalidateAllUserTokens: vi.fn(),
}));

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
    mockCreateAssetFromUpload.mockResolvedValue(mockAsset);
    mockListProjectAssets.mockResolvedValue([mockAsset]);
    mockDeleteAsset.mockResolvedValue(undefined);
    mockGenerateAssetPresignedUrl.mockResolvedValue({
        url: 'https://r2-placeholder.dev/presigned',
        storagePath: 'users/user-uuid/assets/asset-uuid/test.png',
        assetId: '660e8400-e29b-41d4-a716-446655440099',
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getToken(): string {
    return app.jwt.sign({ sub: 'user-uuid-1234' }, { expiresIn: '15m' });
}

function authHeader() {
    return { authorization: `Bearer ${getToken()}` };
}

const projectId = '550e8400-e29b-41d4-a716-446655440000';

// ---------------------------------------------------------------------------
// GET /projects/:id/assets
// ---------------------------------------------------------------------------

describe('GET /api/v1/projects/:id/assets', () => {
    it('lists project assets', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/projects/${projectId}/assets`,
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.data).toHaveLength(1);
        expect(body.data[0].name).toBe('test.png');
    });

    it('rejects without auth with 401', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/projects/${projectId}/assets`,
        });

        expect(res.statusCode).toBe(401);
    });

    it('returns 404 for non-existent project', async () => {
        mockListProjectAssets.mockRejectedValue(AppError.notFound('Project not found'));

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/projects/550e8400-e29b-41d4-a716-446655440001/assets',
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// DELETE /assets/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/assets/:id', () => {
    it('deletes an asset', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: `/api/v1/assets/${mockAsset.id}`,
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().message).toBe('Asset deleted successfully');
    });

    it('returns 404 for non-existent asset', async () => {
        mockDeleteAsset.mockRejectedValue(AppError.notFound('Asset not found'));

        const res = await app.inject({
            method: 'DELETE',
            url: '/api/v1/assets/550e8400-e29b-41d4-a716-446655440099',
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(404);
    });

    it('rejects without auth with 401', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: `/api/v1/assets/${mockAsset.id}`,
        });

        expect(res.statusCode).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// POST /assets/presigned-url
// ---------------------------------------------------------------------------

describe('POST /api/v1/assets/presigned-url', () => {
    it('generates a presigned upload URL', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/assets/presigned-url',
            headers: authHeader(),
            payload: {
                projectId,
                filename: 'test.png',
                contentType: 'image/png',
            },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.url).toBeTruthy();
        expect(body.storagePath).toBeTruthy();
        expect(body.assetId).toBeTruthy();
    });

    it('rejects missing projectId with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/assets/presigned-url',
            headers: authHeader(),
            payload: {
                filename: 'test.png',
                contentType: 'image/png',
            },
        });

        expect(res.statusCode).toBe(400);
    });

    it('rejects without auth with 401', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/assets/presigned-url',
            payload: {
                projectId,
                filename: 'test.png',
                contentType: 'image/png',
            },
        });

        expect(res.statusCode).toBe(401);
    });
});
