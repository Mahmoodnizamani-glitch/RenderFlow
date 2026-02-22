/**
 * Tests for the render API module (src/api/renders.ts).
 *
 * Verifies all 5 API wrappers and the server-to-local mapper.
 */
import { apiClient } from '../client';
import {
    submitRender,
    getRenders,
    getRenderStatus,
    cancelRender,
    getDownloadUrl,
    serverRenderToLocal,
} from '../renders';
import type { ServerRenderJob, SubmitRenderInput } from '../renders';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../client', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SERVER_JOB: ServerRenderJob = {
    id: 'server-job-1',
    userId: 'user-1',
    projectId: 'proj-1',
    status: 'completed',
    renderType: 'cloud',
    settings: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationInFrames: 300,
        format: 'mp4',
    },
    creditsCharged: 5,
    progress: 100,
    currentFrame: 300,
    totalFrames: 300,
    outputUrl: 'https://cdn.example.com/output.mp4',
    outputSize: 5_000_000,
    errorMessage: null,
    startedAt: '2026-02-17T10:00:00.000Z',
    completedAt: '2026-02-17T10:05:00.000Z',
    createdAt: '2026-02-17T09:59:00.000Z',
};

const SUBMIT_INPUT: SubmitRenderInput = {
    projectId: 'proj-1',
    settings: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationInFrames: 300,
        format: 'mp4',
    },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('renders API module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // serverRenderToLocal mapper
    // -----------------------------------------------------------------------

    describe('serverRenderToLocal', () => {
        it('maps server render job to local shape', () => {
            const local = serverRenderToLocal(SERVER_JOB);

            expect(local).toEqual({
                id: 'server-job-1',
                projectId: 'proj-1',
                status: 'completed',
                renderType: 'cloud',
                format: 'mp4',
                quality: 80,
                resolution: '1920x1080',
                fps: 30,
                progress: 100,
                currentFrame: 300,
                totalFrames: 300,
                outputUri: 'https://cdn.example.com/output.mp4',
                remoteJobId: 'server-job-1',
                errorMessage: null,
                startedAt: '2026-02-17T10:00:00.000Z',
                completedAt: '2026-02-17T10:05:00.000Z',
                createdAt: '2026-02-17T09:59:00.000Z',
            });
        });

        it('handles null outputUrl and errorMessage', () => {
            const serverJob = { ...SERVER_JOB, outputUrl: null, errorMessage: 'Some error', status: 'failed' };
            const local = serverRenderToLocal(serverJob);

            expect(local.outputUri).toBeNull();
            expect(local.errorMessage).toBe('Some error');
            expect(local.status).toBe('failed');
        });

        it('derives resolution from width and height', () => {
            const serverJob = {
                ...SERVER_JOB,
                settings: { ...SERVER_JOB.settings, width: 3840, height: 2160 },
            };
            const local = serverRenderToLocal(serverJob);

            expect(local.resolution).toBe('3840x2160');
        });
    });

    // -----------------------------------------------------------------------
    // submitRender
    // -----------------------------------------------------------------------

    describe('submitRender', () => {
        it('posts to /renders and returns mapped job', async () => {
            mockPost.mockResolvedValueOnce({ data: { renderJob: SERVER_JOB } } as never);

            const result = await submitRender(SUBMIT_INPUT);

            expect(mockPost).toHaveBeenCalledWith('/renders', SUBMIT_INPUT);
            expect(result.id).toBe('server-job-1');
            expect(result.projectId).toBe('proj-1');
        });

        it('propagates API errors', async () => {
            mockPost.mockRejectedValueOnce(new Error('Network error'));

            await expect(submitRender(SUBMIT_INPUT)).rejects.toThrow('Network error');
        });
    });

    // -----------------------------------------------------------------------
    // getRenders
    // -----------------------------------------------------------------------

    describe('getRenders', () => {
        it('fetches renders with default params', async () => {
            mockGet.mockResolvedValueOnce({
                data: {
                    data: [SERVER_JOB],
                    meta: { total: 1, page: 1, pageSize: 50, totalPages: 1 },
                },
            } as never);

            const result = await getRenders();

            expect(mockGet).toHaveBeenCalledWith('/renders', {
                params: { page: 1, pageSize: 50 },
            });
            expect(result.renders).toHaveLength(1);
            expect(result.renders[0]!.id).toBe('server-job-1');
            expect(result.meta.total).toBe(1);
        });

        it('passes filter params', async () => {
            mockGet.mockResolvedValueOnce({
                data: {
                    data: [],
                    meta: { total: 0, page: 2, pageSize: 10, totalPages: 0 },
                },
            } as never);

            await getRenders({ page: 2, pageSize: 10, status: 'completed' });

            expect(mockGet).toHaveBeenCalledWith('/renders', {
                params: { page: 2, pageSize: 10, status: 'completed' },
            });
        });
    });

    // -----------------------------------------------------------------------
    // getRenderStatus
    // -----------------------------------------------------------------------

    describe('getRenderStatus', () => {
        it('fetches single render job by id', async () => {
            mockGet.mockResolvedValueOnce({ data: { renderJob: SERVER_JOB } } as never);

            const result = await getRenderStatus('server-job-1');

            expect(mockGet).toHaveBeenCalledWith('/renders/server-job-1');
            expect(result.id).toBe('server-job-1');
            expect(result.status).toBe('completed');
        });
    });

    // -----------------------------------------------------------------------
    // cancelRender
    // -----------------------------------------------------------------------

    describe('cancelRender', () => {
        it('posts cancel and returns updated job', async () => {
            const cancelledJob = { ...SERVER_JOB, status: 'failed', errorMessage: 'Cancelled' };
            mockPost.mockResolvedValueOnce({ data: { renderJob: cancelledJob } } as never);

            const result = await cancelRender('server-job-1');

            expect(mockPost).toHaveBeenCalledWith('/renders/server-job-1/cancel');
            expect(result.status).toBe('failed');
            expect(result.errorMessage).toBe('Cancelled');
        });
    });

    // -----------------------------------------------------------------------
    // getDownloadUrl
    // -----------------------------------------------------------------------

    describe('getDownloadUrl', () => {
        it('fetches download URL', async () => {
            mockGet.mockResolvedValueOnce({
                data: {
                    downloadUrl: 'https://cdn.example.com/signed-url',
                    expiresIn: 3600,
                },
            } as never);

            const result = await getDownloadUrl('server-job-1');

            expect(mockGet).toHaveBeenCalledWith('/renders/server-job-1/download');
            expect(result.downloadUrl).toBe('https://cdn.example.com/signed-url');
            expect(result.expiresIn).toBe(3600);
        });
    });
});
