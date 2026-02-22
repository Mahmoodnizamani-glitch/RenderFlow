/**
 * Project routes integration tests.
 *
 * Mocks the project service layer to test route handling, validation,
 * auth enforcement, pagination, and response shapes.
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
// Mock env singleton (for asset routes calling getEnv)
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
// Mock project service
// ---------------------------------------------------------------------------

const mockProject = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    userId: 'user-uuid-1234',
    name: 'My Project',
    description: 'A test project',
    code: 'const x = 1;',
    thumbnailUrl: null,
    compositionSettings: { width: 1920, height: 1080, fps: 30, durationInFrames: 150 },
    variables: {},
    isTemplate: false,
    isPublic: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const mockCreateProject = vi.fn();
const mockGetProjectById = vi.fn();
const mockListProjects = vi.fn();
const mockUpdateProject = vi.fn();
const mockDeleteProject = vi.fn();
const mockDuplicateProject = vi.fn();

vi.mock('../../services/project.service.js', () => ({
    createProject: (...args: unknown[]) => mockCreateProject(...args),
    getProjectById: (...args: unknown[]) => mockGetProjectById(...args),
    listProjects: (...args: unknown[]) => mockListProjects(...args),
    updateProject: (...args: unknown[]) => mockUpdateProject(...args),
    deleteProject: (...args: unknown[]) => mockDeleteProject(...args),
    duplicateProject: (...args: unknown[]) => mockDuplicateProject(...args),
}));

// Also mock storage/asset services so asset routes don't crash during app init
vi.mock('../../services/storage.service.js', () => ({
    initStorage: vi.fn(() => ({
        uploadFile: vi.fn(),
        deleteFile: vi.fn(),
        generatePresignedUploadUrl: vi.fn(),
        getPublicUrl: vi.fn(),
    })),
    buildAssetStoragePath: vi.fn(),
    resetStorage: vi.fn(),
}));

vi.mock('../../services/asset.service.js', () => ({
    createAssetFromUpload: vi.fn(),
    listProjectAssets: vi.fn(),
    deleteAsset: vi.fn(),
    generateAssetPresignedUrl: vi.fn(),
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
    mockCreateProject.mockResolvedValue(mockProject);
    mockGetProjectById.mockResolvedValue(mockProject);
    mockListProjects.mockResolvedValue({
        data: [mockProject],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasMore: false },
    });
    mockUpdateProject.mockResolvedValue({ ...mockProject, name: 'Updated' });
    mockDeleteProject.mockResolvedValue(undefined);
    mockDuplicateProject.mockResolvedValue({ ...mockProject, name: 'My Project (copy)' });
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

// ---------------------------------------------------------------------------
// POST /projects
// ---------------------------------------------------------------------------

describe('POST /api/v1/projects', () => {
    it('creates a project and returns 201', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/projects',
            headers: authHeader(),
            payload: { name: 'My Project' },
        });

        expect(res.statusCode).toBe(201);
        const body = res.json();
        expect(body.project.name).toBe('My Project');
        expect(body.project.id).toBeTruthy();
    });

    it('rejects missing name with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/projects',
            headers: authHeader(),
            payload: {},
        });

        expect(res.statusCode).toBe(400);
    });

    it('rejects without auth with 401', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/projects',
            payload: { name: 'No Auth' },
        });

        expect(res.statusCode).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// GET /projects
// ---------------------------------------------------------------------------

describe('GET /api/v1/projects', () => {
    it('returns paginated project list', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/projects',
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.data).toHaveLength(1);
        expect(body.meta.total).toBe(1);
        expect(body.meta.page).toBe(1);
        expect(body.meta.limit).toBe(20);
        expect(body.meta.hasMore).toBe(false);
    });

    it('passes search query to service', async () => {
        await app.inject({
            method: 'GET',
            url: '/api/v1/projects?search=test&page=2&limit=10',
            headers: authHeader(),
        });

        expect(mockListProjects).toHaveBeenCalledWith(
            expect.anything(),
            'user-uuid-1234',
            expect.objectContaining({
                search: 'test',
                page: 2,
                limit: 10,
            }),
        );
    });

    it('rejects without auth with 401', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/projects',
        });

        expect(res.statusCode).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// GET /projects/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/projects/:id', () => {
    it('returns a project by ID', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/projects/${mockProject.id}`,
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().project.id).toBe(mockProject.id);
    });

    it('returns 404 for non-existent project', async () => {
        mockGetProjectById.mockRejectedValue(AppError.notFound('Project not found'));

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/projects/550e8400-e29b-41d4-a716-446655440001',
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(404);
    });

    it('rejects invalid UUID with 400', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/projects/not-a-uuid',
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// PUT /projects/:id
// ---------------------------------------------------------------------------

describe('PUT /api/v1/projects/:id', () => {
    it('updates a project', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: `/api/v1/projects/${mockProject.id}`,
            headers: authHeader(),
            payload: { name: 'Updated' },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().project.name).toBe('Updated');
    });

    it('returns 404 for non-existent project', async () => {
        mockUpdateProject.mockRejectedValue(AppError.notFound('Project not found'));

        const res = await app.inject({
            method: 'PUT',
            url: '/api/v1/projects/550e8400-e29b-41d4-a716-446655440001',
            headers: authHeader(),
            payload: { name: 'test' },
        });

        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// DELETE /projects/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/projects/:id', () => {
    it('deletes a project', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: `/api/v1/projects/${mockProject.id}`,
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().message).toBe('Project deleted successfully');
    });

    it('returns 404 for non-existent project', async () => {
        mockDeleteProject.mockRejectedValue(AppError.notFound('Project not found'));

        const res = await app.inject({
            method: 'DELETE',
            url: '/api/v1/projects/550e8400-e29b-41d4-a716-446655440001',
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// POST /projects/:id/duplicate
// ---------------------------------------------------------------------------

describe('POST /api/v1/projects/:id/duplicate', () => {
    it('duplicates a project', async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/projects/${mockProject.id}/duplicate`,
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(201);
        expect(res.json().project.name).toBe('My Project (copy)');
    });

    it('returns 404 for non-existent project', async () => {
        mockDuplicateProject.mockRejectedValue(AppError.notFound('Project not found'));

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/projects/550e8400-e29b-41d4-a716-446655440001/duplicate',
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(404);
    });
});
