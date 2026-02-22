/**
 * Tests for useRenderStore.
 *
 * Mocks RenderJobRepository and verifies store actions update state correctly.
 */
import type { RenderJob } from '@renderflow/shared';
import { AppError, ErrorCode } from '../../errors/AppError';

// ---------------------------------------------------------------------------
// Mock RenderJobRepository — define mocks inside factory to avoid hoisting issues
// ---------------------------------------------------------------------------

jest.mock('../../db/repositories', () => ({
    RenderJobRepository: {
        create: jest.fn(),
        getById: jest.fn(),
        getByProject: jest.fn(),
        getAll: jest.fn(),
        updateProgress: jest.fn(),
        updateStatus: jest.fn(),
        getLatest: jest.fn(),
        count: jest.fn(),
    },
}));

// Import after mock so we can access the mocked functions
import { RenderJobRepository } from '../../db/repositories';
import { useRenderStore } from '../useRenderStore';

// Cast to jest.Mock for type-safe access in tests
interface MockedRenderRepo {
    create: jest.Mock;
    getById: jest.Mock;
    getByProject: jest.Mock;
    getAll: jest.Mock;
    updateProgress: jest.Mock;
    updateStatus: jest.Mock;
    getLatest: jest.Mock;
    count: jest.Mock;
}
const mockedRepo = RenderJobRepository as unknown as MockedRenderRepo;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const JOB_UUID_1 = '11111111-1111-4111-8111-111111111111';
const JOB_UUID_2 = '22222222-2222-4222-8222-222222222222';
const JOB_UUID_3 = '33333333-3333-4333-8333-333333333333';
const JOB_UUID_4 = '44444444-4444-4444-8444-444444444444';
const PROJECT_UUID = '55555555-5555-4555-8555-555555555555';

function mockJob(overrides: Partial<RenderJob> = {}): RenderJob {
    return {
        id: JOB_UUID_1,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRenderStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useRenderStore.setState({
            activeJobs: [],
            jobHistory: [],
            isLoading: false,
            error: null,
        });
    });

    describe('loadActiveJobs', () => {
        it('loads only active (queued/processing/encoding) jobs', async () => {
            const jobs = [
                mockJob({ id: JOB_UUID_1, status: 'queued' }),
                mockJob({ id: JOB_UUID_2, status: 'processing' }),
                mockJob({ id: JOB_UUID_3, status: 'completed' }),
                mockJob({ id: JOB_UUID_4, status: 'encoding' }),
            ];
            mockedRepo.getAll.mockResolvedValue(jobs);

            await useRenderStore.getState().loadActiveJobs();

            const state = useRenderStore.getState();
            expect(state.activeJobs).toHaveLength(3); // queued + processing + encoding
            expect(state.isLoading).toBe(false);
        });

        it('sets error on failure', async () => {
            mockedRepo.getAll.mockRejectedValue(
                AppError.database('Load failed'),
            );

            await useRenderStore.getState().loadActiveJobs();

            const state = useRenderStore.getState();
            expect(state.error?.code).toBe(ErrorCode.DATABASE_ERROR);
            expect(state.isLoading).toBe(false);
        });
    });

    describe('loadHistory', () => {
        it('loads all jobs into history', async () => {
            const jobs = [
                mockJob({ id: JOB_UUID_1, status: 'completed' }),
                mockJob({ id: JOB_UUID_2, status: 'failed' }),
            ];
            mockedRepo.getAll.mockResolvedValue(jobs);

            await useRenderStore.getState().loadHistory();

            const state = useRenderStore.getState();
            expect(state.jobHistory).toHaveLength(2);
            expect(state.isLoading).toBe(false);
        });

        it('passes limit and offset options', async () => {
            mockedRepo.getAll.mockResolvedValue([]);

            await useRenderStore.getState().loadHistory({ limit: 10, offset: 20 });

            expect(mockedRepo.getAll).toHaveBeenCalledWith({
                limit: 10,
                offset: 20,
            });
        });
    });

    describe('loadJobsByProject', () => {
        it('returns jobs for a specific project', async () => {
            const jobs = [mockJob({ id: JOB_UUID_1 }), mockJob({ id: JOB_UUID_2 })];
            mockedRepo.getByProject.mockResolvedValue(jobs);

            const result = await useRenderStore.getState().loadJobsByProject(PROJECT_UUID);

            expect(result).toHaveLength(2);
            expect(mockedRepo.getByProject).toHaveBeenCalledWith(PROJECT_UUID);
        });
    });

    describe('createJob', () => {
        it('creates a job and adds it to activeJobs', async () => {
            const job = mockJob();
            mockedRepo.create.mockResolvedValue(job);

            const result = await useRenderStore.getState().createJob({
                projectId: PROJECT_UUID,
            });

            expect(result.id).toBe(JOB_UUID_1);
            expect(useRenderStore.getState().activeJobs).toHaveLength(1);
            expect(useRenderStore.getState().activeJobs[0]!.id).toBe(JOB_UUID_1);
        });

        it('sets error and throws on failure', async () => {
            mockedRepo.create.mockRejectedValue(
                AppError.database('Create failed'),
            );

            await expect(
                useRenderStore.getState().createJob({ projectId: PROJECT_UUID }),
            ).rejects.toThrow(AppError);

            expect(useRenderStore.getState().error).not.toBeNull();
        });
    });

    describe('updateProgress', () => {
        it('updates progress of an active job', async () => {
            const activeJob = mockJob({ id: JOB_UUID_1, progress: 0 });
            useRenderStore.setState({ activeJobs: [activeJob] });

            const updatedJob = mockJob({ id: JOB_UUID_1, progress: 50, currentFrame: 150 });
            mockedRepo.updateProgress.mockResolvedValue(updatedJob);

            await useRenderStore.getState().updateProgress(JOB_UUID_1, 50, 150);

            const state = useRenderStore.getState();
            expect(state.activeJobs[0]!.progress).toBe(50);
            expect(state.activeJobs[0]!.currentFrame).toBe(150);
        });
    });

    describe('updateStatus', () => {
        it('keeps job in activeJobs when status is still active', async () => {
            const job = mockJob({ id: JOB_UUID_1, status: 'queued' });
            useRenderStore.setState({ activeJobs: [job] });

            const updatedJob = mockJob({ id: JOB_UUID_1, status: 'processing' });
            mockedRepo.updateStatus.mockResolvedValue(updatedJob);

            await useRenderStore.getState().updateStatus(JOB_UUID_1, 'processing');

            const state = useRenderStore.getState();
            expect(state.activeJobs).toHaveLength(1);
            expect(state.activeJobs[0]!.status).toBe('processing');
        });

        it('moves job from activeJobs to jobHistory when completed', async () => {
            const job = mockJob({ id: JOB_UUID_1, status: 'encoding' });
            useRenderStore.setState({
                activeJobs: [job],
                jobHistory: [],
            });

            const completedJob = mockJob({ id: JOB_UUID_1, status: 'completed', progress: 100 });
            mockedRepo.updateStatus.mockResolvedValue(completedJob);

            await useRenderStore.getState().updateStatus(JOB_UUID_1, 'completed');

            const state = useRenderStore.getState();
            expect(state.activeJobs).toHaveLength(0);
            expect(state.jobHistory).toHaveLength(1);
            expect(state.jobHistory[0]!.status).toBe('completed');
        });

        it('moves job from activeJobs to jobHistory when failed', async () => {
            const job = mockJob({ id: JOB_UUID_1, status: 'processing' });
            useRenderStore.setState({
                activeJobs: [job],
                jobHistory: [],
            });

            const failedJob = mockJob({ id: JOB_UUID_1, status: 'failed', errorMessage: 'OOM' });
            mockedRepo.updateStatus.mockResolvedValue(failedJob);

            await useRenderStore.getState().updateStatus(JOB_UUID_1, 'failed', {
                errorMessage: 'OOM',
            });

            const state = useRenderStore.getState();
            expect(state.activeJobs).toHaveLength(0);
            expect(state.jobHistory).toHaveLength(1);
            expect(state.jobHistory[0]!.errorMessage).toBe('OOM');
        });
    });

    describe('getLatestForProject', () => {
        it('returns the latest job for a project', async () => {
            const job = mockJob({ status: 'completed' });
            mockedRepo.getLatest.mockResolvedValue(job);

            const result = await useRenderStore.getState().getLatestForProject(PROJECT_UUID);
            expect(result).not.toBeNull();
            expect(result!.id).toBe(JOB_UUID_1);
        });

        it('returns null when no jobs exist', async () => {
            mockedRepo.getLatest.mockResolvedValue(null);

            const result = await useRenderStore.getState().getLatestForProject('empty');
            expect(result).toBeNull();
        });
    });

    describe('clearError', () => {
        it('clears the error state', () => {
            useRenderStore.setState({
                error: AppError.database('Test error'),
            });

            useRenderStore.getState().clearError();
            expect(useRenderStore.getState().error).toBeNull();
        });
    });
});
