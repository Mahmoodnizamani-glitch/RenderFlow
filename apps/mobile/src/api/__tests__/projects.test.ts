/**
 * Tests for the Project API module.
 *
 * Mocks the apiClient to verify request/response mapping
 * between local and server project shapes.
 */

// ---------------------------------------------------------------------------
// Mock
// ---------------------------------------------------------------------------

jest.mock('../client', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
    },
}));

import {
    fetchProjects,
    fetchProject,
    createRemoteProject,
    updateRemoteProject,
    deleteRemoteProject,
    serverToLocal,
    localToServerCreate,
    localToServerUpdate,
} from '../projects';
import { apiClient } from '../client';

const mockedClient = apiClient as unknown as {
    get: jest.Mock;
    post: jest.Mock;
    put: jest.Mock;
    delete: jest.Mock;
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SERVER_PROJECT = {
    id: 'remote-1',
    userId: 'user-1',
    name: 'Test Project',
    description: 'A test project',
    code: 'const x = 1;',
    thumbnailUrl: null,
    compositionSettings: { width: 1920, height: 1080, fps: 30, durationInFrames: 150 },
    variables: { color: '#fff' },
    isTemplate: false,
    isPublic: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Project API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('fetchProjects', () => {
        it('calls GET /projects with pagination params', async () => {
            mockedClient.get.mockResolvedValue({
                data: {
                    data: [SERVER_PROJECT],
                    meta: { total: 1, page: 1, pageSize: 100, totalPages: 1 },
                },
            });

            const result = await fetchProjects(1, 100);

            expect(mockedClient.get).toHaveBeenCalledWith('/projects', {
                params: { page: 1, pageSize: 100 },
            });
            expect(result.projects).toHaveLength(1);
            expect(result.projects[0]!.id).toBe('remote-1');
        });
    });

    describe('fetchProject', () => {
        it('calls GET /projects/:id', async () => {
            mockedClient.get.mockResolvedValue({
                data: { project: SERVER_PROJECT },
            });

            const result = await fetchProject('remote-1');

            expect(mockedClient.get).toHaveBeenCalledWith('/projects/remote-1');
            expect(result.name).toBe('Test Project');
        });
    });

    describe('createRemoteProject', () => {
        it('calls POST /projects with mapped payload', async () => {
            mockedClient.post.mockResolvedValue({
                data: { project: SERVER_PROJECT },
            });

            const input = {
                name: 'Test Project',
                description: 'A test project',
                code: 'const x = 1;',
                compositionWidth: 1920,
                compositionHeight: 1080,
                fps: 30,
                durationInFrames: 150,
                variables: { color: '#fff' },
            };

            const result = await createRemoteProject(input);

            expect(mockedClient.post).toHaveBeenCalledWith('/projects', expect.objectContaining({
                name: 'Test Project',
                compositionSettings: expect.objectContaining({
                    width: 1920,
                    height: 1080,
                }),
            }));
            expect(result.id).toBe('remote-1');
        });
    });

    describe('updateRemoteProject', () => {
        it('calls PUT /projects/:id with partial payload', async () => {
            mockedClient.put.mockResolvedValue({
                data: { project: { ...SERVER_PROJECT, name: 'Updated' } },
            });

            const result = await updateRemoteProject('remote-1', { name: 'Updated' });

            expect(mockedClient.put).toHaveBeenCalledWith('/projects/remote-1', {
                name: 'Updated',
            });
            expect(result.name).toBe('Updated');
        });
    });

    describe('deleteRemoteProject', () => {
        it('calls DELETE /projects/:id', async () => {
            mockedClient.delete.mockResolvedValue({});

            await deleteRemoteProject('remote-1');

            expect(mockedClient.delete).toHaveBeenCalledWith('/projects/remote-1');
        });
    });
});

// ---------------------------------------------------------------------------
// Mapper tests
// ---------------------------------------------------------------------------

describe('Project Mappers', () => {
    describe('serverToLocal', () => {
        it('maps server project to local shape with defaults', () => {
            const result = serverToLocal(SERVER_PROJECT);

            expect(result.name).toBe('Test Project');
            expect(result.remoteId).toBe('remote-1');
            expect(result.syncStatus).toBe('synced');
            expect(result.compositionWidth).toBe(1920);
            expect(result.compositionHeight).toBe(1080);
            expect(result.fps).toBe(30);
            expect(result.isFavorite).toBe(false);
        });

        it('preserves existing local-only fields', () => {
            const existing = {
                id: 'local-1',
                isFavorite: true,
                thumbnailUri: '/local/thumb.png',
            };

            const result = serverToLocal(SERVER_PROJECT, existing);

            expect(result.id).toBe('local-1');
            expect(result.isFavorite).toBe(true);
            expect(result.thumbnailUri).toBe('/local/thumb.png');
        });
    });

    describe('localToServerCreate', () => {
        it('maps local create input to server payload', () => {
            const input = {
                name: 'New Project',
                description: 'Desc',
                code: 'code',
                compositionWidth: 1280,
                compositionHeight: 720,
                fps: 60,
                durationInFrames: 300,
                variables: { foo: 'bar' },
            };

            const result = localToServerCreate(input);

            expect(result['name']).toBe('New Project');
            expect(result['compositionSettings']).toEqual({
                width: 1280,
                height: 720,
                fps: 60,
                durationInFrames: 300,
            });
        });
    });

    describe('localToServerUpdate', () => {
        it('only includes changed fields', () => {
            const result = localToServerUpdate({ name: 'Updated' });

            expect(result['name']).toBe('Updated');
            expect(result['compositionSettings']).toBeUndefined();
        });

        it('packs composition fields into compositionSettings', () => {
            const result = localToServerUpdate({ compositionWidth: 1280 });

            expect(result['compositionSettings']).toEqual({ width: 1280 });
        });
    });
});
