/**
 * Render service unit tests.
 *
 * Tests CRUD operations for render jobs with mocked database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CreateRenderJobData } from '../render.service.js';

// ---------------------------------------------------------------------------
// Mock database builder — fluent chainable API
// ---------------------------------------------------------------------------

interface MockRow {
    id: string;
    userId: string;
    projectId: string;
    status: string;
    renderType: string;
    settings: Record<string, unknown>;
    creditsCharged: number;
    codeUrl: string | null;
    bullmqJobId: string | null;
    progress: number;
    currentFrame: number;
    totalFrames: number;
    outputUrl: string | null;
    outputSize: number | null;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
}

function createMockRow(overrides?: Partial<MockRow>): MockRow {
    return {
        id: 'render-001',
        userId: 'user-123',
        projectId: 'proj-001',
        status: 'queued',
        renderType: 'cloud',
        settings: { format: 'mp4', quality: 80 },
        creditsCharged: 5,
        codeUrl: null,
        bullmqJobId: 'bull-001',
        progress: 0,
        currentFrame: 0,
        totalFrames: 150,
        outputUrl: null,
        outputSize: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: new Date('2026-01-15T12:00:00Z'),
        ...overrides,
    };
}

let mockInsertResult: MockRow[] = [];
let mockSelectResult: MockRow[] = [];
let mockUpdateResult: MockRow[] = [];
let mockCountResult: { count: number }[] = [{ count: 1 }];

const mockDb = {
    insert: vi.fn(() => mockDb),
    values: vi.fn(() => mockDb),
    returning: vi.fn(() => Promise.resolve(mockInsertResult)),
    select: vi.fn((..._args: unknown[]) => mockDb),
    from: vi.fn(() => mockDb),
    where: vi.fn(() => mockDb),
    limit: vi.fn(() => Promise.resolve(mockSelectResult)),
    orderBy: vi.fn(() => mockDb),
    offset: vi.fn(() => mockDb),
    then: undefined as unknown, // prevents Promise detection
    update: vi.fn(() => mockDb),
    set: vi.fn(() => mockDb),
};

// Override `then` to allow different usage contexts
// For paginated queries that await `orderBy().offset()`, resolve to mockSelectResult
const _resolveAsSelect = () => Promise.resolve(mockSelectResult);
const _resolveAsCount = () => Promise.resolve(mockCountResult);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('render service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockInsertResult = [createMockRow()];
        mockSelectResult = [createMockRow()];
        mockUpdateResult = [createMockRow()];
        mockCountResult = [{ count: 1 }];
    });

    describe('createRenderJob', () => {
        it('inserts a render job and returns the row', async () => {
            const { createRenderJob } = await import('../render.service.js');

            const data: CreateRenderJobData = {
                projectId: 'proj-001',
                settings: { format: 'mp4', quality: 80 },
                creditsCharged: 5,
                codeUrl: 'https://r2.example.com/code.js',
                bullmqJobId: 'bull-001',
                totalFrames: 150,
            };

            const result = await createRenderJob(mockDb as never, 'user-123', data);

            expect(mockDb.insert).toHaveBeenCalledOnce();
            expect(result.id).toBe('render-001');
            expect(result.userId).toBe('user-123');
            expect(result.status).toBe('queued');
        });

        it('throws when insert returns no rows', async () => {
            mockInsertResult = [];
            const { createRenderJob } = await import('../render.service.js');

            const data: CreateRenderJobData = {
                projectId: 'proj-001',
                settings: {},
                creditsCharged: 5,
                codeUrl: 'https://r2.example.com/code.js',
                bullmqJobId: 'bull-001',
                totalFrames: 150,
            };

            await expect(createRenderJob(mockDb as never, 'user-123', data)).rejects.toThrow(
                /failed to create/i,
            );
        });
    });

    describe('getRenderJobById', () => {
        it('returns the render job for the owning user', async () => {
            const { getRenderJobById } = await import('../render.service.js');

            const result = await getRenderJobById(mockDb as never, 'render-001', 'user-123');

            expect(result.id).toBe('render-001');
            expect(mockDb.where).toHaveBeenCalledOnce();
        });

        it('throws not found when no job matches', async () => {
            mockSelectResult = [];
            const { getRenderJobById } = await import('../render.service.js');

            await expect(
                getRenderJobById(mockDb as never, 'nonexistent', 'user-123'),
            ).rejects.toThrow(/not found/i);
        });
    });

    describe('getRenderJobByIdInternal', () => {
        it('returns the render job without ownership check', async () => {
            const { getRenderJobByIdInternal } = await import('../render.service.js');

            const result = await getRenderJobByIdInternal(mockDb as never, 'render-001');

            expect(result.id).toBe('render-001');
        });

        it('throws not found when no job matches', async () => {
            mockSelectResult = [];
            const { getRenderJobByIdInternal } = await import('../render.service.js');

            await expect(
                getRenderJobByIdInternal(mockDb as never, 'nonexistent'),
            ).rejects.toThrow(/not found/i);
        });
    });

    describe('updateRenderJobStatus', () => {
        it('updates status and returns updated row', async () => {
            mockUpdateResult = [createMockRow({ status: 'processing', progress: 50 })];
            mockDb.returning.mockResolvedValueOnce(mockUpdateResult);

            const { updateRenderJobStatus } = await import('../render.service.js');

            const result = await updateRenderJobStatus(mockDb as never, 'render-001', {
                status: 'processing' as never,
                progress: 50,
            });

            expect(mockDb.update).toHaveBeenCalledOnce();
            expect(result.status).toBe('processing');
        });

        it('throws not found when update returns no rows', async () => {
            mockDb.returning.mockResolvedValueOnce([]);

            const { updateRenderJobStatus } = await import('../render.service.js');

            await expect(
                updateRenderJobStatus(mockDb as never, 'nonexistent', {
                    status: 'processing' as never,
                }),
            ).rejects.toThrow(/not found/i);
        });
    });

    describe('cancelRenderJob', () => {
        it('cancels a queued render job', async () => {
            mockSelectResult = [createMockRow({ status: 'queued' })];
            mockDb.returning.mockResolvedValueOnce([createMockRow({ status: 'failed', errorMessage: 'Cancelled by user' })]);

            const { cancelRenderJob } = await import('../render.service.js');

            const result = await cancelRenderJob(mockDb as never, 'render-001', 'user-123');

            expect(result.status).toBe('failed');
        });

        it('throws when trying to cancel a completed render', async () => {
            mockSelectResult = [createMockRow({ status: 'completed' })];

            const { cancelRenderJob } = await import('../render.service.js');

            await expect(
                cancelRenderJob(mockDb as never, 'render-001', 'user-123'),
            ).rejects.toThrow();
        });

        it('throws not found when render does not exist', async () => {
            mockSelectResult = [];

            const { cancelRenderJob } = await import('../render.service.js');

            await expect(
                cancelRenderJob(mockDb as never, 'nonexistent', 'user-123'),
            ).rejects.toThrow(/not found/i);
        });
    });

    describe('findStaleJobs', () => {
        it('returns jobs older than specified minutes', async () => {
            const staleJob = createMockRow({ status: 'processing', startedAt: new Date('2026-01-15T10:00:00Z') });
            // For findStaleJobs that doesn't use limit(), override the chain
            mockDb.where.mockResolvedValueOnce([staleJob] as never);

            const { findStaleJobs } = await import('../render.service.js');

            const result = await findStaleJobs(mockDb as never, 30);

            expect(Array.isArray(result)).toBe(true);
        });
    });
});
