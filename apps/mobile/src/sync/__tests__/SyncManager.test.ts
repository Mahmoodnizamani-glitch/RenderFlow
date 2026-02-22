/**
 * Tests for SyncManager.
 *
 * Mocks SyncRepository, ProjectRepository, and API functions to verify
 * sync orchestration, conflict resolution, throttling, and error handling.
 */
import type { Project } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../SyncRepository', () => ({
    SyncRepository: {
        enqueue: jest.fn(),
        getPendingActions: jest.fn().mockResolvedValue([]),
        markInProgress: jest.fn(),
        markFailed: jest.fn(),
        markConflict: jest.fn(),
        remove: jest.fn(),
        getByEntityId: jest.fn().mockResolvedValue([]),
        incrementRetry: jest.fn().mockResolvedValue(1),
        getPendingCount: jest.fn().mockResolvedValue(0),
        clearAll: jest.fn(),
    },
}));

jest.mock('../../db/repositories', () => ({
    ProjectRepository: {
        getById: jest.fn(),
        getAll: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
}));

jest.mock('../../api/projects', () => ({
    createRemoteProject: jest.fn(),
    updateRemoteProject: jest.fn(),
    deleteRemoteProject: jest.fn(),
    fetchProjects: jest.fn().mockResolvedValue({ projects: [], meta: {} }),
    fetchProject: jest.fn(),
    serverToLocal: jest.fn(),
}));

jest.mock('../../api/secureStorage', () => ({
    getAccessToken: jest.fn().mockResolvedValue('test-token'),
}));

import { SyncManager } from '../SyncManager';
import { SyncRepository } from '../SyncRepository';
import { ProjectRepository } from '../../db/repositories';
import {
    createRemoteProject,
    updateRemoteProject,
    deleteRemoteProject,
    fetchProjects,
    serverToLocal,
} from '../../api/projects';
import { getAccessToken } from '../../api/secureStorage';

// Typed mocks
const mockedSyncRepo = SyncRepository as unknown as {
    enqueue: jest.Mock;
    getPendingActions: jest.Mock;
    markInProgress: jest.Mock;
    markFailed: jest.Mock;
    markConflict: jest.Mock;
    remove: jest.Mock;
    getByEntityId: jest.Mock;
    incrementRetry: jest.Mock;
    getPendingCount: jest.Mock;
    clearAll: jest.Mock;
};

const mockedProjectRepo = ProjectRepository as unknown as {
    getById: jest.Mock;
    getAll: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
};

const mockedCreateRemote = createRemoteProject as jest.Mock;
const mockedUpdateRemote = updateRemoteProject as jest.Mock;
const mockedDeleteRemote = deleteRemoteProject as jest.Mock;
const mockedFetchProjects = fetchProjects as jest.Mock;
const mockedServerToLocal = serverToLocal as jest.Mock;
const mockedGetAccessToken = getAccessToken as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockProject(overrides: Partial<Project> = {}): Project {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Test Project',
        description: '',
        code: '',
        thumbnailUri: null,
        compositionWidth: 1920,
        compositionHeight: 1080,
        fps: 30,
        durationInFrames: 150,
        variables: {},
        isFavorite: false,
        syncStatus: 'local',
        remoteId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        SyncManager.reset();
        mockedGetAccessToken.mockResolvedValue('test-token');
    });

    // -----------------------------------------------------------------------
    // trackChange
    // -----------------------------------------------------------------------

    describe('trackChange', () => {
        it('snapshots the project and enqueues a sync action', async () => {
            const project = mockProject();
            mockedProjectRepo.getById.mockResolvedValue(project);
            mockedSyncRepo.enqueue.mockResolvedValue({
                id: 'sync-1',
                entityType: 'project',
                entityId: project.id,
                changeType: 'create',
                payload: JSON.stringify(project),
                retryCount: 0,
                status: 'pending',
                errorMessage: null,
                createdAt: '2026-01-01T00:00:00.000Z',
            });
            mockedProjectRepo.update.mockResolvedValue(project);

            await SyncManager.trackChange('project', project.id, 'create');

            expect(mockedProjectRepo.getById).toHaveBeenCalledWith(project.id);
            expect(mockedSyncRepo.enqueue).toHaveBeenCalledWith(
                'project',
                project.id,
                'create',
                JSON.stringify(project),
            );
        });

        it('enqueues delete with remoteId for server deletion', async () => {
            const project = mockProject({ remoteId: 'remote-1' });
            mockedProjectRepo.getById.mockResolvedValue(project);
            mockedSyncRepo.enqueue.mockResolvedValue({
                id: 'sync-1',
                entityType: 'project',
                entityId: project.id,
                changeType: 'delete',
                payload: JSON.stringify({ id: project.id, remoteId: 'remote-1' }),
                retryCount: 0,
                status: 'pending',
                errorMessage: null,
                createdAt: '2026-01-01T00:00:00.000Z',
            });

            await SyncManager.trackChange('project', project.id, 'delete');

            expect(mockedSyncRepo.enqueue).toHaveBeenCalledWith(
                'project',
                project.id,
                'delete',
                JSON.stringify({ id: project.id, remoteId: 'remote-1' }),
            );
        });
    });

    // -----------------------------------------------------------------------
    // syncPendingChanges
    // -----------------------------------------------------------------------

    describe('syncPendingChanges', () => {
        it('skips sync when not authenticated', async () => {
            mockedGetAccessToken.mockResolvedValue(null);

            await SyncManager.syncPendingChanges();

            expect(mockedSyncRepo.getPendingActions).not.toHaveBeenCalled();
        });

        it('pushes create action to API and links remoteId', async () => {
            const project = mockProject();
            const remoteProject = { id: 'remote-1', name: project.name, createdAt: project.createdAt, updatedAt: project.updatedAt };

            mockedSyncRepo.getPendingActions.mockResolvedValue([{
                id: 'sync-1',
                entityType: 'project',
                entityId: project.id,
                changeType: 'create',
                payload: JSON.stringify(project),
                retryCount: 0,
                status: 'pending',
                errorMessage: null,
                createdAt: '2026-01-01T00:00:00.000Z',
            }]);

            mockedCreateRemote.mockResolvedValue(remoteProject);
            mockedProjectRepo.update.mockResolvedValue(project);

            await SyncManager.syncPendingChanges();

            expect(mockedSyncRepo.markInProgress).toHaveBeenCalledWith('sync-1');
            expect(mockedCreateRemote).toHaveBeenCalled();
            expect(mockedProjectRepo.update).toHaveBeenCalledWith(
                project.id,
                { remoteId: 'remote-1', syncStatus: 'synced' },
            );
            expect(mockedSyncRepo.remove).toHaveBeenCalledWith('sync-1');
        });

        it('pushes update action to API', async () => {
            const project = mockProject({ remoteId: 'remote-1' });

            mockedSyncRepo.getPendingActions.mockResolvedValue([{
                id: 'sync-2',
                entityType: 'project',
                entityId: project.id,
                changeType: 'update',
                payload: JSON.stringify(project),
                retryCount: 0,
                status: 'pending',
                errorMessage: null,
                createdAt: '2026-01-01T00:00:00.000Z',
            }]);

            mockedUpdateRemote.mockResolvedValue({ id: 'remote-1' });
            mockedProjectRepo.update.mockResolvedValue(project);

            await SyncManager.syncPendingChanges();

            expect(mockedUpdateRemote).toHaveBeenCalledWith('remote-1', expect.anything());
            expect(mockedProjectRepo.update).toHaveBeenCalledWith(
                project.id,
                { syncStatus: 'synced' },
            );
            expect(mockedSyncRepo.remove).toHaveBeenCalledWith('sync-2');
        });

        it('pushes delete action to API', async () => {
            mockedSyncRepo.getPendingActions.mockResolvedValue([{
                id: 'sync-3',
                entityType: 'project',
                entityId: '11111111-1111-4111-8111-111111111111',
                changeType: 'delete',
                payload: JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', remoteId: 'remote-1' }),
                retryCount: 0,
                status: 'pending',
                errorMessage: null,
                createdAt: '2026-01-01T00:00:00.000Z',
            }]);

            mockedDeleteRemote.mockResolvedValue(undefined);

            await SyncManager.syncPendingChanges();

            expect(mockedDeleteRemote).toHaveBeenCalledWith('remote-1');
            expect(mockedSyncRepo.remove).toHaveBeenCalledWith('sync-3');
        });

        it('marks action as conflict after max retries', async () => {
            mockedSyncRepo.getPendingActions.mockResolvedValue([{
                id: 'sync-4',
                entityType: 'project',
                entityId: '11111111-1111-4111-8111-111111111111',
                changeType: 'create',
                payload: JSON.stringify(mockProject()),
                retryCount: 2,
                status: 'pending',
                errorMessage: null,
                createdAt: '2026-01-01T00:00:00.000Z',
            }]);

            mockedCreateRemote.mockRejectedValue(new Error('Server error'));
            mockedSyncRepo.incrementRetry.mockResolvedValue(3);
            mockedProjectRepo.update.mockResolvedValue(mockProject());

            await SyncManager.syncPendingChanges();

            expect(mockedSyncRepo.incrementRetry).toHaveBeenCalledWith('sync-4');
            expect(mockedProjectRepo.update).toHaveBeenCalledWith(
                '11111111-1111-4111-8111-111111111111',
                { syncStatus: 'conflict' },
            );
        });
    });

    // -----------------------------------------------------------------------
    // pullRemoteChanges
    // -----------------------------------------------------------------------

    describe('pullRemoteChanges', () => {
        it('skips pull when not authenticated', async () => {
            mockedGetAccessToken.mockResolvedValue(null);

            await SyncManager.pullRemoteChanges();

            expect(mockedFetchProjects).not.toHaveBeenCalled();
        });

        it('upserts new remote projects locally', async () => {
            const remoteProject = {
                id: 'remote-new',
                userId: 'user-1',
                name: 'Remote Project',
                description: 'desc',
                code: 'code',
                thumbnailUrl: null,
                compositionSettings: null,
                variables: null,
                isTemplate: false,
                isPublic: false,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
            };

            mockedFetchProjects.mockResolvedValue({
                projects: [remoteProject],
                meta: { total: 1, page: 1, pageSize: 100, totalPages: 1 },
            });

            mockedProjectRepo.getAll.mockResolvedValue([]);
            mockedServerToLocal.mockReturnValue(mockProject({ name: 'Remote Project' }));
            mockedProjectRepo.create.mockResolvedValue(mockProject({ name: 'Remote Project' }));

            await SyncManager.pullRemoteChanges();

            expect(mockedProjectRepo.create).toHaveBeenCalled();
        });

        it('resolves conflict with last-write-wins (remote newer)', async () => {
            const localProject = mockProject({
                remoteId: 'remote-1',
                updatedAt: '2026-01-01T00:00:00.000Z',
            });

            const remoteProject = {
                id: 'remote-1',
                userId: 'user-1',
                name: 'Updated Remote',
                description: '',
                code: '',
                thumbnailUrl: null,
                compositionSettings: null,
                variables: null,
                isTemplate: false,
                isPublic: false,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-02-01T00:00:00.000Z', // Newer
            };

            mockedFetchProjects.mockResolvedValue({
                projects: [remoteProject],
                meta: { total: 1, page: 1, pageSize: 100, totalPages: 1 },
            });

            mockedProjectRepo.getAll.mockResolvedValue([localProject]);
            mockedSyncRepo.getByEntityId.mockResolvedValue([]);
            mockedServerToLocal.mockReturnValue(
                mockProject({ name: 'Updated Remote', syncStatus: 'synced' }),
            );
            mockedProjectRepo.update.mockResolvedValue(localProject);

            await SyncManager.pullRemoteChanges();

            expect(mockedProjectRepo.update).toHaveBeenCalledWith(
                localProject.id,
                expect.objectContaining({ name: 'Updated Remote', syncStatus: 'synced' }),
            );
        });

        it('skips remote update when local has pending changes', async () => {
            const localProject = mockProject({
                remoteId: 'remote-1',
                updatedAt: '2026-01-01T00:00:00.000Z',
            });

            const remoteProject = {
                id: 'remote-1',
                userId: 'user-1',
                name: 'Updated Remote',
                description: '',
                code: '',
                thumbnailUrl: null,
                compositionSettings: null,
                variables: null,
                isTemplate: false,
                isPublic: false,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-02-01T00:00:00.000Z',
            };

            mockedFetchProjects.mockResolvedValue({
                projects: [remoteProject],
                meta: { total: 1, page: 1, pageSize: 100, totalPages: 1 },
            });

            mockedProjectRepo.getAll.mockResolvedValue([localProject]);
            mockedSyncRepo.getByEntityId.mockResolvedValue([{
                id: 'sync-pending',
                entityType: 'project',
                entityId: localProject.id,
                changeType: 'update',
                status: 'pending',
                retryCount: 0,
                payload: '{}',
                errorMessage: null,
                createdAt: '2026-01-01T00:00:00.000Z',
            }]);

            await SyncManager.pullRemoteChanges();

            // Should not update local project because it has pending changes
            expect(mockedProjectRepo.update).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // runFullSync
    // -----------------------------------------------------------------------

    describe('runFullSync', () => {
        it('skips sync when not authenticated', async () => {
            mockedGetAccessToken.mockResolvedValue(null);

            await SyncManager.runFullSync();

            expect(mockedSyncRepo.getPendingActions).not.toHaveBeenCalled();
        });

        it('throttles auto-sync to once per 60 seconds', async () => {
            mockedSyncRepo.getPendingActions.mockResolvedValue([]);
            mockedFetchProjects.mockResolvedValue({ projects: [], meta: {} });

            await SyncManager.runFullSync();

            // Second call should be throttled
            await SyncManager.runFullSync();

            // fetchProjects should only be called once (from the first sync)
            expect(mockedFetchProjects).toHaveBeenCalledTimes(1);
        });

        it('forceSync bypasses throttle', async () => {
            mockedSyncRepo.getPendingActions.mockResolvedValue([]);
            mockedFetchProjects.mockResolvedValue({ projects: [], meta: {} });

            await SyncManager.runFullSync();
            await SyncManager.forceSync();

            // fetchProjects should be called twice
            expect(mockedFetchProjects).toHaveBeenCalledTimes(2);
        });
    });
});
