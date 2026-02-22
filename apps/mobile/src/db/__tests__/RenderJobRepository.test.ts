/**
 * Tests for RenderJobRepository.
 *
 * Mocks the Drizzle database layer to verify repository logic:
 * CRUD, progress/status updates, getLatest, and error handling.
 */
import type { RenderJob } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const MOCK_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';
const PROJECT_UUID = '33333333-3333-4333-8333-333333333333';

jest.mock('expo-crypto', () => ({
    randomUUID: jest.fn(() => MOCK_UUID),
}));

function createSelectChain(rows: unknown[] = []) {
    const chain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => resolve(rows)),
    };
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    chain.orderBy.mockReturnValue(chain);
    chain.offset.mockReturnValue(chain);
    return chain;
}

function createInsertChain() {
    return {
        values: jest.fn().mockResolvedValue(undefined),
    };
}

function createUpdateChain() {
    const chain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(undefined),
    };
    chain.set.mockReturnValue(chain);
    return chain;
}

jest.mock('../client', () => {
    const mockDb = {
        insert: jest.fn(),
        select: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    };
    return {
        getDb: jest.fn(() => mockDb),
    };
});

import { RenderJobRepository } from '../repositories/RenderJobRepository';
import { getDb } from '../client';
import { AppError as _AppError, ErrorCode } from '../../errors/AppError';

interface MockDb {
    insert: jest.Mock;
    select: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRenderJob(overrides: Partial<RenderJob> = {}): RenderJob {
    return {
        id: MOCK_UUID,
        projectId: PROJECT_UUID,
        status: 'queued',
        renderType: 'cloud',
        format: 'mp4',
        quality: 80,
        resolution: '1920x1080',
        fps: 30,
        progress: 0,
        currentFrame: 0,
        totalFrames: 300,
        outputUri: null,
        remoteJobId: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

function getDbMock(): MockDb {
    return (getDb as jest.Mock)() as MockDb;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RenderJobRepository', () => {
    let db: MockDb;

    beforeEach(() => {
        jest.clearAllMocks();
        db = getDbMock();
    });

    describe('create', () => {
        it('creates a render job with defaults', async () => {
            const insertChain = createInsertChain();
            db.insert.mockReturnValue(insertChain);

            const job = mockRenderJob();
            db.select.mockReturnValue(createSelectChain([job]));

            const result = await RenderJobRepository.create({
                projectId: PROJECT_UUID,
            });

            expect(db.insert).toHaveBeenCalled();
            expect(insertChain.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: MOCK_UUID,
                    projectId: PROJECT_UUID,
                    status: 'queued',
                    renderType: 'cloud',
                    format: 'mp4',
                    progress: 0,
                }),
            );
            expect(result.status).toBe('queued');
        });

        it('creates a render job with custom options', async () => {
            const insertChain = createInsertChain();
            db.insert.mockReturnValue(insertChain);

            const job = mockRenderJob({ renderType: 'local', format: 'webm', fps: 60 });
            db.select.mockReturnValue(createSelectChain([job]));

            const result = await RenderJobRepository.create({
                projectId: PROJECT_UUID,
                renderType: 'local',
                format: 'webm',
                fps: 60,
                totalFrames: 600,
            });

            expect(insertChain.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    renderType: 'local',
                    format: 'webm',
                    fps: 60,
                    totalFrames: 600,
                }),
            );
            expect(result.renderType).toBe('local');
        });

        it('throws AppError on database failure', async () => {
            db.insert.mockReturnValue({
                values: jest.fn().mockRejectedValue(new Error('DB error')),
            });

            await expect(
                RenderJobRepository.create({ projectId: PROJECT_UUID }),
            ).rejects.toMatchObject({ code: ErrorCode.DATABASE_ERROR });
        });
    });

    describe('getById', () => {
        it('returns render job when found', async () => {
            const job = mockRenderJob();
            db.select.mockReturnValue(createSelectChain([job]));

            const result = await RenderJobRepository.getById(MOCK_UUID);
            expect(result.id).toBe(MOCK_UUID);
            expect(result.status).toBe('queued');
        });

        it('throws NOT_FOUND when render job does not exist', async () => {
            db.select.mockReturnValue(createSelectChain([]));

            await expect(RenderJobRepository.getById('missing')).rejects.toMatchObject({
                code: ErrorCode.NOT_FOUND,
            });
        });
    });

    describe('getByProject', () => {
        it('returns render jobs for a project', async () => {
            const j1 = mockRenderJob({ id: UUID_1, status: 'completed' });
            const j2 = mockRenderJob({ id: UUID_2, status: 'queued' });
            db.select.mockReturnValue(createSelectChain([j1, j2]));

            const results = await RenderJobRepository.getByProject(PROJECT_UUID);
            expect(results).toHaveLength(2);
        });
    });

    describe('getAll', () => {
        it('returns all render jobs', async () => {
            const j1 = mockRenderJob({ id: UUID_1 });
            const j2 = mockRenderJob({ id: UUID_2 });
            db.select.mockReturnValue(createSelectChain([j1, j2]));

            const results = await RenderJobRepository.getAll();
            expect(results).toHaveLength(2);
        });

        it('returns empty array when no jobs exist', async () => {
            db.select.mockReturnValue(createSelectChain([]));

            const results = await RenderJobRepository.getAll();
            expect(results).toHaveLength(0);
        });
    });

    describe('updateProgress', () => {
        it('updates progress and current frame', async () => {
            const original = mockRenderJob({ progress: 0, currentFrame: 0 });
            const updated = mockRenderJob({ progress: 50, currentFrame: 150 });

            let selectCallCount = 0;
            db.select.mockImplementation(() => {
                selectCallCount++;
                return selectCallCount <= 1
                    ? createSelectChain([original])
                    : createSelectChain([updated]);
            });

            const updateChain = createUpdateChain();
            db.update.mockReturnValue(updateChain);

            const result = await RenderJobRepository.updateProgress(MOCK_UUID, 50, 150);

            expect(db.update).toHaveBeenCalled();
            expect(updateChain.set).toHaveBeenCalledWith({ progress: 50, currentFrame: 150 });
            expect(result.progress).toBe(50);
            expect(result.currentFrame).toBe(150);
        });

        it('throws NOT_FOUND for nonexistent job', async () => {
            db.select.mockReturnValue(createSelectChain([]));

            await expect(
                RenderJobRepository.updateProgress('missing', 50, 150),
            ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
        });
    });

    describe('updateStatus', () => {
        it('updates status to processing and auto-sets startedAt', async () => {
            const original = mockRenderJob();
            const updated = mockRenderJob({
                status: 'processing',
                startedAt: '2026-01-01T00:01:00.000Z',
            });

            let selectCallCount = 0;
            db.select.mockImplementation(() => {
                selectCallCount++;
                return selectCallCount <= 1
                    ? createSelectChain([original])
                    : createSelectChain([updated]);
            });

            const updateChain = createUpdateChain();
            db.update.mockReturnValue(updateChain);

            const result = await RenderJobRepository.updateStatus(MOCK_UUID, 'processing');

            expect(db.update).toHaveBeenCalled();
            expect(updateChain.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'processing',
                    startedAt: expect.any(String),
                }),
            );
            expect(result.status).toBe('processing');
        });

        it('updates status to completed with auto-completedAt and progress=100', async () => {
            const original = mockRenderJob({ status: 'encoding', progress: 95 });
            const updated = mockRenderJob({
                status: 'completed',
                progress: 100,
                completedAt: '2026-01-01T00:05:00.000Z',
            });

            let selectCallCount = 0;
            db.select.mockImplementation(() => {
                selectCallCount++;
                return selectCallCount <= 1
                    ? createSelectChain([original])
                    : createSelectChain([updated]);
            });

            const updateChain = createUpdateChain();
            db.update.mockReturnValue(updateChain);

            const result = await RenderJobRepository.updateStatus(MOCK_UUID, 'completed');

            expect(updateChain.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'completed',
                    progress: 100,
                    completedAt: expect.any(String),
                }),
            );
            expect(result.status).toBe('completed');
        });

        it('updates status to failed with error message', async () => {
            const original = mockRenderJob({ status: 'processing' });
            const updated = mockRenderJob({
                status: 'failed',
                errorMessage: 'Out of memory',
                completedAt: '2026-01-01T00:05:00.000Z',
            });

            let selectCallCount = 0;
            db.select.mockImplementation(() => {
                selectCallCount++;
                return selectCallCount <= 1
                    ? createSelectChain([original])
                    : createSelectChain([updated]);
            });

            const updateChain = createUpdateChain();
            db.update.mockReturnValue(updateChain);

            const result = await RenderJobRepository.updateStatus(MOCK_UUID, 'failed', {
                errorMessage: 'Out of memory',
            });

            expect(updateChain.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'failed',
                    errorMessage: 'Out of memory',
                }),
            );
            expect(result.status).toBe('failed');
        });
    });

    describe('getLatest', () => {
        it('returns the latest render job for a project', async () => {
            const job = mockRenderJob({ status: 'completed' });
            db.select.mockReturnValue(createSelectChain([job]));

            const result = await RenderJobRepository.getLatest(PROJECT_UUID);
            expect(result).not.toBeNull();
            expect(result!.id).toBe(MOCK_UUID);
        });

        it('returns null when no jobs exist for project', async () => {
            db.select.mockReturnValue(createSelectChain([]));

            const result = await RenderJobRepository.getLatest(PROJECT_UUID);
            expect(result).toBeNull();
        });
    });

    describe('count', () => {
        it('returns total render job count', async () => {
            db.select.mockReturnValue(createSelectChain([{ count: 42 }]));

            const result = await RenderJobRepository.count();
            expect(result).toBe(42);
        });

        it('returns count filtered by projectId', async () => {
            db.select.mockReturnValue(createSelectChain([{ count: 3 }]));

            const result = await RenderJobRepository.count(PROJECT_UUID);
            expect(result).toBe(3);
        });
    });
});
