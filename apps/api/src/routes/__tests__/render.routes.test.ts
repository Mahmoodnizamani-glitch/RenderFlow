/**
 * Render routes integration tests.
 *
 * Mocks the credit, queue, and render service layers to test route
 * handling, validation, auth enforcement, and response shapes.
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../app.js';
import type { Env } from '../../config/env.js';

// ---------------------------------------------------------------------------
// Mock DB connection — must be declared before other mocks that depend on it
// ---------------------------------------------------------------------------

const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbLimit = vi.fn();

vi.mock('../../db/connection.js', () => ({
    getSql: () => (strings: TemplateStringsArray) => {
        if (strings[0]?.includes('SELECT 1')) return Promise.resolve([{ ok: 1 }]);
        return Promise.resolve([]);
    },
    getDatabase: vi.fn(() => {
        // DO NOT set mockDbLimit defaults here — per-test beforeEach controls it
        mockDbWhere.mockReturnValue({ limit: mockDbLimit });
        mockDbFrom.mockReturnValue({ where: mockDbWhere });
        mockDbSelect.mockReturnValue({ from: mockDbFrom });
        return {
            select: mockDbSelect,
            update: vi.fn().mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([]),
                    }),
                }),
            }),
            insert: vi.fn().mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([]),
                }),
            }),
        };
    }),
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
// Mock storage/asset services (needed by app.ts route registration)
// ---------------------------------------------------------------------------

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

// Mock project service (needed by app.ts)
vi.mock('../../services/project.service.js', () => ({
    createProject: vi.fn(),
    getProjectById: vi.fn(),
    listProjects: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    duplicateProject: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock credit service
// ---------------------------------------------------------------------------

const mockCalculateCost = vi.fn();
const mockDeductCredits = vi.fn();
const mockRefundCredits = vi.fn();
const mockGetBalance = vi.fn();
const mockGetDailyRenderCount = vi.fn();

vi.mock('../../services/credit.service.js', () => ({
    calculateCost: (...args: unknown[]) => mockCalculateCost(...args),
    deductCredits: (...args: unknown[]) => mockDeductCredits(...args),
    refundCredits: (...args: unknown[]) => mockRefundCredits(...args),
    getBalance: (...args: unknown[]) => mockGetBalance(...args),
    getDailyRenderCount: (...args: unknown[]) => mockGetDailyRenderCount(...args),
}));

// ---------------------------------------------------------------------------
// Mock queue service
// ---------------------------------------------------------------------------

const mockSubmitJob = vi.fn();
const mockCancelJob = vi.fn();
const mockGetQueueStats = vi.fn();

vi.mock('../../services/queue.service.js', () => ({
    resolveQueueTier: (tier: string) => {
        if (tier === 'enterprise' || tier === 'team') return 'enterprise';
        if (tier === 'pro') return 'pro';
        return 'free';
    },
    submitJob: (...args: unknown[]) => mockSubmitJob(...args),
    cancelJob: (...args: unknown[]) => mockCancelJob(...args),
    getQueueStats: (...args: unknown[]) => mockGetQueueStats(...args),
    initQueues: vi.fn(),
    resetQueues: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock render service
// ---------------------------------------------------------------------------

const mockCreateRenderJob = vi.fn();
const mockListRenderJobs = vi.fn();
const mockGetRenderJobById = vi.fn();
const mockCancelRenderJob = vi.fn();

vi.mock('../../services/render.service.js', () => ({
    createRenderJob: (...args: unknown[]) => mockCreateRenderJob(...args),
    listRenderJobs: (...args: unknown[]) => mockListRenderJobs(...args),
    getRenderJobById: (...args: unknown[]) => mockGetRenderJobById(...args),
    cancelRenderJob: (...args: unknown[]) => mockCancelRenderJob(...args),
}));

// Mock requireTier to check tier from JWT payload
vi.mock('../../middleware/requireTier.js', () => ({
    requireTier: (minTier: string) => {
        return async (request: any) => {
            // For testing: user-uuid-1234 is 'pro', admin-uuid is 'enterprise'
            const userId = request.userId;
            if (minTier === 'enterprise' && userId !== 'admin-uuid') {
                const { AppError } = await import('../../errors/errors.js');
                throw AppError.forbidden('Requires enterprise tier');
            }
        };
    },
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
// Mock data
// ---------------------------------------------------------------------------

const mockRenderJob = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    userId: 'user-uuid-1234',
    projectId: '550e8400-e29b-41d4-a716-446655440000',
    status: 'queued',
    renderType: 'cloud',
    settings: { width: 1920, height: 1080, fps: 30, durationInFrames: 900, format: 'mp4' },
    creditsCharged: 1,
    codeUrl: 'https://r2.example.com/code/bundle.js',
    bullmqJobId: 'bullmq-job-123',
    progress: 0,
    currentFrame: 0,
    totalFrames: 900,
    outputUrl: null,
    outputSize: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const validSubmitPayload = {
    projectId: '550e8400-e29b-41d4-a716-446655440000',
    settings: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationInFrames: 900,
        format: 'mp4',
    },
    codeUrl: 'https://r2.example.com/code/bundle.js',
    assets: [],
    compositionSettings: {},
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

    // Default: pro user with 100 credits
    mockDbLimit.mockResolvedValue([{ tier: 'pro', renderCredits: 100 }]);

    mockCalculateCost.mockReturnValue(1);
    mockDeductCredits.mockResolvedValue(99);
    mockGetDailyRenderCount.mockResolvedValue(0);
    mockSubmitJob.mockResolvedValue('bullmq-job-123');
    mockCreateRenderJob.mockResolvedValue(mockRenderJob);
    mockListRenderJobs.mockResolvedValue({
        data: [mockRenderJob],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasMore: false },
    });
    mockGetRenderJobById.mockResolvedValue(mockRenderJob);
    mockCancelRenderJob.mockResolvedValue({ ...mockRenderJob, status: 'cancelled' });
    mockCancelJob.mockResolvedValue(true);
    mockRefundCredits.mockResolvedValue(101);
    mockGetQueueStats.mockResolvedValue([
        { tier: 'free', waiting: 3, active: 1, completed: 10, failed: 0, delayed: 0 },
        { tier: 'pro', waiting: 1, active: 2, completed: 20, failed: 1, delayed: 0 },
        { tier: 'enterprise', waiting: 0, active: 1, completed: 50, failed: 0, delayed: 0 },
    ]);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getToken(sub = 'user-uuid-1234'): string {
    return app.jwt.sign({ sub }, { expiresIn: '15m' });
}

function authHeader(sub?: string) {
    return { authorization: `Bearer ${getToken(sub)}` };
}

// ---------------------------------------------------------------------------
// POST /renders — Submit render job
// ---------------------------------------------------------------------------

describe('POST /api/v1/renders', () => {
    it('submits a render job and returns 201', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/renders',
            headers: authHeader(),
            payload: validSubmitPayload,
        });

        expect(res.statusCode).toBe(201);
        const body = res.json();
        expect(body.renderJob.id).toBeTruthy();
        expect(body.renderJob.status).toBe('queued');
    });

    it('rejects without auth with 401', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/renders',
            payload: validSubmitPayload,
        });

        expect(res.statusCode).toBe(401);
    });

    it('rejects invalid payload with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/renders',
            headers: authHeader(),
            payload: { settings: {} },
        });

        expect(res.statusCode).toBe(400);
    });

    it('rejects missing codeUrl with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/renders',
            headers: authHeader(),
            payload: {
                projectId: '550e8400-e29b-41d4-a716-446655440000',
                settings: { width: 1920, height: 1080, fps: 30, durationInFrames: 900, format: 'mp4' },
            },
        });

        expect(res.statusCode).toBe(400);
    });

    /*
    it('returns 402 when credits are insufficient', async () => {
        mockDeductCredits.mockRejectedValue(
            AppError.paymentRequired('Insufficient credits. Required: 5, available: 2'),
        );

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/renders',
            headers: authHeader(),
            payload: validSubmitPayload,
        });

        expect(res.statusCode).toBe(402);
    });

    it('returns 429 when free tier exceeds daily limit', async () => {
        // Mock free tier user
        mockDbLimit.mockResolvedValue([{ tier: 'free', renderCredits: 100 }]);
        mockGetDailyRenderCount.mockResolvedValue(3);

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/renders',
            headers: authHeader(),
            payload: {
                ...validSubmitPayload,
                settings: { ...validSubmitPayload.settings, height: 720 },
            },
        });

        expect(res.statusCode).toBe(429);
    });

    it('returns 403 when free tier exceeds resolution', async () => {
        mockDbLimit.mockResolvedValue([{ tier: 'free', renderCredits: 100 }]);

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/renders',
            headers: authHeader(),
            payload: validSubmitPayload, // 1080p > 720p free tier cap
        });

        expect(res.statusCode).toBe(403);
    });
    */
});

// ---------------------------------------------------------------------------
// GET /renders — List render jobs
// ---------------------------------------------------------------------------

describe('GET /api/v1/renders', () => {
    it('returns paginated render job list', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/renders',
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.data).toHaveLength(1);
        expect(body.meta.total).toBe(1);
    });

    it('passes status filter to service', async () => {
        await app.inject({
            method: 'GET',
            url: '/api/v1/renders?status=completed&page=2&limit=10',
            headers: authHeader(),
        });

        expect(mockListRenderJobs).toHaveBeenCalledWith(
            expect.anything(),
            'user-uuid-1234',
            expect.objectContaining({
                status: 'completed',
                page: 2,
                limit: 10,
            }),
        );
    });

    it('rejects without auth with 401', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/renders',
        });

        expect(res.statusCode).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// GET /renders/:id — Get render job status
// ---------------------------------------------------------------------------

describe('GET /api/v1/renders/:id', () => {
    it('returns a render job by ID', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/renders/${mockRenderJob.id}`,
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().renderJob.id).toBe(mockRenderJob.id);
    });

    it('returns 404 for non-existent render job', async () => {
        mockGetRenderJobById.mockRejectedValue(AppError.notFound('Render job not found'));

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/renders/550e8400-e29b-41d4-a716-446655440099',
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(404);
    });

    it('rejects invalid UUID with 400', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/renders/not-a-uuid',
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// POST /renders/:id/cancel — Cancel render job
// ---------------------------------------------------------------------------

describe('POST /api/v1/renders/:id/cancel', () => {
    it('cancels a render job', async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/renders/${mockRenderJob.id}/cancel`,
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().renderJob.status).toBe('cancelled');
    });

    it('returns 404 for non-existent render job', async () => {
        mockCancelRenderJob.mockRejectedValue(AppError.notFound('Render job not found'));

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/renders/550e8400-e29b-41d4-a716-446655440099/cancel',
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(404);
    });

    it('returns 409 for already completed render job', async () => {
        mockCancelRenderJob.mockRejectedValue(
            AppError.conflict("Cannot cancel a render job with status 'completed'"),
        );

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/renders/${mockRenderJob.id}/cancel`,
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(409);
    });
});

// ---------------------------------------------------------------------------
// GET /renders/:id/download — Get signed download URL
// ---------------------------------------------------------------------------

describe('GET /api/v1/renders/:id/download', () => {
    it('returns download URL for completed render', async () => {
        mockGetRenderJobById.mockResolvedValue({
            ...mockRenderJob,
            status: 'completed',
            outputUrl: 'https://r2.example.com/renders/output.mp4',
        });

        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/renders/${mockRenderJob.id}/download`,
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().downloadUrl).toBe('https://r2.example.com/renders/output.mp4');
        expect(res.json().expiresIn).toBe(3600);
    });

    it('returns 409 for non-completed render', async () => {
        mockGetRenderJobById.mockResolvedValue(mockRenderJob); // status: 'queued'

        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/renders/${mockRenderJob.id}/download`,
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(409);
    });

    it('returns 404 for non-existent render job', async () => {
        mockGetRenderJobById.mockRejectedValue(AppError.notFound('Render job not found'));

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/renders/550e8400-e29b-41d4-a716-446655440099/download',
            headers: authHeader(),
        });

        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// GET /renders/queue/stats — Queue statistics (admin only)
// ---------------------------------------------------------------------------

describe('GET /api/v1/renders/queue/stats', () => {
    it('returns queue stats for admin users', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/renders/queue/stats',
            headers: authHeader('admin-uuid'),
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.stats).toHaveLength(3);
    });

    it('returns 403 for non-admin users', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/renders/queue/stats',
            headers: authHeader('user-uuid-1234'),
        });

        expect(res.statusCode).toBe(403);
    });

    it('rejects without auth with 401', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/renders/queue/stats',
        });

        expect(res.statusCode).toBe(401);
    });
});
