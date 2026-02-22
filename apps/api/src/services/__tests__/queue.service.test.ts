/**
 * Queue service unit tests.
 *
 * Mocks BullMQ Queue to test tier routing, priority assignment,
 * job cancel, and queue stats.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock BullMQ
// ---------------------------------------------------------------------------

const mockAdd = vi.fn();
const mockGetJob = vi.fn();
const mockGetJobCounts = vi.fn();
const mockClose = vi.fn();

vi.mock('bullmq', () => ({
    Queue: vi.fn().mockImplementation(() => ({
        add: mockAdd,
        getJob: mockGetJob,
        getJobCounts: mockGetJobCounts,
        close: mockClose,
    })),
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

const {
    initQueues,
    submitJob,
    cancelJob,
    getQueueStats,
    getJobBullMQStatus,
    resolveQueueTier,
    resetQueues,
} = await import('../queue.service.js');

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    resetQueues();
});

afterEach(() => {
    resetQueues();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockJobData = {
    renderJobId: 'render-job-123',
    userId: 'user-123',
    projectId: 'project-123',
    codeUrl: 'https://r2.example.com/code/bundle.js',
    assets: [{ name: 'logo.png', url: 'https://r2.example.com/assets/logo.png' }],
    compositionSettings: { width: 1920, height: 1080 },
    renderSettings: { format: 'mp4', fps: 30, durationInFrames: 900 },
};

function setupQueues() {
    initQueues({ host: 'localhost', port: 6379 });
}

// ---------------------------------------------------------------------------
// resolveQueueTier
// ---------------------------------------------------------------------------

describe('resolveQueueTier', () => {
    it('maps free to free', () => {
        expect(resolveQueueTier('free')).toBe('free');
    });

    it('maps pro to pro', () => {
        expect(resolveQueueTier('pro')).toBe('pro');
    });

    it('maps enterprise to enterprise', () => {
        expect(resolveQueueTier('enterprise')).toBe('enterprise');
    });

    it('maps team to enterprise', () => {
        expect(resolveQueueTier('team')).toBe('enterprise');
    });

    it('maps unknown tiers to free', () => {
        expect(resolveQueueTier('unknown')).toBe('free');
    });
});

// ---------------------------------------------------------------------------
// initQueues
// ---------------------------------------------------------------------------

describe('initQueues', () => {
    it('creates three queues (free, pro, enterprise)', () => {
        const queues = initQueues({ host: 'localhost', port: 6379 });
        expect(queues.size).toBe(3);
        expect(queues.has('free')).toBe(true);
        expect(queues.has('pro')).toBe(true);
        expect(queues.has('enterprise')).toBe(true);
    });

    it('returns the same queues on subsequent calls', () => {
        const first = initQueues({ host: 'localhost', port: 6379 });
        const second = initQueues({ host: 'localhost', port: 6379 });
        expect(first).toBe(second);
    });
});

// ---------------------------------------------------------------------------
// submitJob
// ---------------------------------------------------------------------------

describe('submitJob', () => {
    it('adds a job to the free queue with priority 10', async () => {
        setupQueues();
        mockAdd.mockResolvedValue({ id: 'render-job-123' });

        const jobId = await submitJob('free', mockJobData);

        expect(jobId).toBe('render-job-123');
        expect(mockAdd).toHaveBeenCalledWith(
            'render',
            mockJobData,
            expect.objectContaining({ priority: 10 }),
        );
    });

    it('adds a job to the pro queue with priority 5', async () => {
        setupQueues();
        mockAdd.mockResolvedValue({ id: 'render-job-123' });

        await submitJob('pro', mockJobData);

        expect(mockAdd).toHaveBeenCalledWith(
            'render',
            mockJobData,
            expect.objectContaining({ priority: 5 }),
        );
    });

    it('adds a job to the enterprise queue with priority 1', async () => {
        setupQueues();
        mockAdd.mockResolvedValue({ id: 'render-job-123' });

        await submitJob('enterprise', mockJobData);

        expect(mockAdd).toHaveBeenCalledWith(
            'render',
            mockJobData,
            expect.objectContaining({ priority: 1 }),
        );
    });

    it('throws when queues are not initialised', async () => {
        await expect(submitJob('free', mockJobData)).rejects.toThrow(
            'Queues not initialised',
        );
    });
});

// ---------------------------------------------------------------------------
// cancelJob
// ---------------------------------------------------------------------------

describe('cancelJob', () => {
    it('removes a waiting job', async () => {
        setupQueues();
        const mockRemove = vi.fn();
        mockGetJob.mockResolvedValue({
            getState: vi.fn().mockResolvedValue('waiting'),
            remove: mockRemove,
        });

        const result = await cancelJob('job-123', 'free');

        expect(result).toBe(true);
        expect(mockRemove).toHaveBeenCalled();
    });

    it('moves an active job to failed', async () => {
        setupQueues();
        const mockMoveToFailed = vi.fn();
        mockGetJob.mockResolvedValue({
            getState: vi.fn().mockResolvedValue('active'),
            moveToFailed: mockMoveToFailed,
        });

        const result = await cancelJob('job-123', 'free');

        expect(result).toBe(true);
        expect(mockMoveToFailed).toHaveBeenCalled();
    });

    it('returns false for completed jobs', async () => {
        setupQueues();
        mockGetJob.mockResolvedValue({
            getState: vi.fn().mockResolvedValue('completed'),
        });

        const result = await cancelJob('job-123', 'free');

        expect(result).toBe(false);
    });

    it('returns false when job is not found', async () => {
        setupQueues();
        mockGetJob.mockResolvedValue(null);

        const result = await cancelJob('nonexistent', 'free');

        expect(result).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// getJobBullMQStatus
// ---------------------------------------------------------------------------

describe('getJobBullMQStatus', () => {
    it('returns state and progress', async () => {
        setupQueues();
        mockGetJob.mockResolvedValue({
            getState: vi.fn().mockResolvedValue('active'),
            progress: 42,
        });

        const status = await getJobBullMQStatus('job-123', 'free');

        expect(status).toEqual({ state: 'active', progress: 42 });
    });

    it('returns null when job is not found', async () => {
        setupQueues();
        mockGetJob.mockResolvedValue(null);

        const status = await getJobBullMQStatus('nonexistent', 'free');

        expect(status).toBeNull();
    });

    it('defaults progress to 0 when not a number', async () => {
        setupQueues();
        mockGetJob.mockResolvedValue({
            getState: vi.fn().mockResolvedValue('waiting'),
            progress: 'some-string',
        });

        const status = await getJobBullMQStatus('job-123', 'free');

        expect(status).toEqual({ state: 'waiting', progress: 0 });
    });
});

// ---------------------------------------------------------------------------
// getQueueStats
// ---------------------------------------------------------------------------

describe('getQueueStats', () => {
    it('returns stats for all three tiers', async () => {
        setupQueues();
        mockGetJobCounts.mockResolvedValue({
            waiting: 5,
            active: 2,
            completed: 10,
            failed: 1,
            delayed: 0,
        });

        const stats = await getQueueStats();

        expect(stats).toHaveLength(3);
        expect(stats[0]).toEqual(
            expect.objectContaining({ waiting: 5, active: 2 }),
        );
    });
});
