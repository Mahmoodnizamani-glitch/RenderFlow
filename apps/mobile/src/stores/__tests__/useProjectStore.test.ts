/**
 * Tests for useProjectStore.
 *
 * Mocks ProjectRepository and verifies store actions update state correctly.
 */
import type { Project } from '@renderflow/shared';
import { AppError, ErrorCode } from '../../errors/AppError';

// ---------------------------------------------------------------------------
// Mock ProjectRepository — define mocks inside factory to avoid hoisting issues
// ---------------------------------------------------------------------------

jest.mock('../../db/repositories', () => ({
    ProjectRepository: {
        create: jest.fn(),
        getById: jest.fn(),
        getAll: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        duplicate: jest.fn(),
        search: jest.fn(),
        toggleFavorite: jest.fn(),
        count: jest.fn(),
    },
}));

jest.mock('../../sync/SyncManager', () => ({
    SyncManager: {
        trackChange: jest.fn().mockResolvedValue(undefined),
        onStatusChange: jest.fn(),
        runFullSync: jest.fn().mockResolvedValue(undefined),
        forceSync: jest.fn().mockResolvedValue(undefined),
        reset: jest.fn(),
    },
}));

// Import after mock so we can access the mocked functions
import { ProjectRepository } from '../../db/repositories';
import { useProjectStore } from '../useProjectStore';

// Cast to jest.Mock for type-safe access in tests
interface MockedProjectRepo {
    create: jest.Mock;
    getById: jest.Mock;
    getAll: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    duplicate: jest.Mock;
    search: jest.Mock;
    toggleFavorite: jest.Mock;
    count: jest.Mock;
}
const mockedRepo = ProjectRepository as unknown as MockedProjectRepo;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';

function mockProject(overrides: Partial<Project> = {}): Project {
    return {
        id: UUID_1,
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

describe('useProjectStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useProjectStore.setState({
            projects: [],
            selectedProjectId: null,
            searchQuery: '',
            isLoading: false,
            error: null,
        });
    });

    describe('loadProjects', () => {
        it('loads projects from repository and updates state', async () => {
            const projects = [
                mockProject({ id: UUID_1, name: 'P1' }),
                mockProject({ id: UUID_2, name: 'P2' }),
            ];
            mockedRepo.getAll.mockResolvedValue(projects);

            await useProjectStore.getState().loadProjects();

            const state = useProjectStore.getState();
            expect(state.projects).toHaveLength(2);
            expect(state.isLoading).toBe(false);
            expect(state.error).toBeNull();
        });

        it('sets error state on failure', async () => {
            mockedRepo.getAll.mockRejectedValue(
                AppError.database('Connection failed'),
            );

            await useProjectStore.getState().loadProjects();

            const state = useProjectStore.getState();
            expect(state.error).not.toBeNull();
            expect(state.error?.code).toBe(ErrorCode.DATABASE_ERROR);
            expect(state.isLoading).toBe(false);
        });

        it('sets isLoading while fetching', async () => {
            let resolvePromise: (value: Project[]) => void;
            const promise = new Promise<Project[]>((resolve) => {
                resolvePromise = resolve;
            });
            mockedRepo.getAll.mockReturnValue(promise);

            const loadPromise = useProjectStore.getState().loadProjects();

            expect(useProjectStore.getState().isLoading).toBe(true);

            resolvePromise!([]);
            await loadPromise;

            expect(useProjectStore.getState().isLoading).toBe(false);
        });
    });

    describe('createProject', () => {
        it('creates a project and prepends it to the list', async () => {
            const existing = mockProject({ id: UUID_1, name: 'Existing' });
            useProjectStore.setState({ projects: [existing] });

            const newProject = mockProject({ id: UUID_2, name: 'New' });
            mockedRepo.create.mockResolvedValue(newProject);

            const result = await useProjectStore.getState().createProject({ name: 'New' });

            const state = useProjectStore.getState();
            expect(state.projects).toHaveLength(2);
            expect(state.projects[0]!.name).toBe('New');
            expect(result.name).toBe('New');
        });

        it('sets error and throws on failure', async () => {
            mockedRepo.create.mockRejectedValue(
                AppError.database('Create failed'),
            );

            await expect(
                useProjectStore.getState().createProject({ name: 'Fail' }),
            ).rejects.toThrow(AppError);

            expect(useProjectStore.getState().error).not.toBeNull();
        });
    });

    describe('updateProject', () => {
        it('updates a project in the list', async () => {
            const project = mockProject({ id: UUID_1, name: 'Old Name' });
            useProjectStore.setState({ projects: [project] });

            const updated = mockProject({ id: UUID_1, name: 'New Name' });
            mockedRepo.update.mockResolvedValue(updated);

            const result = await useProjectStore.getState().updateProject(UUID_1, { name: 'New Name' });

            expect(result.name).toBe('New Name');
            expect(useProjectStore.getState().projects[0]!.name).toBe('New Name');
        });
    });

    describe('deleteProject', () => {
        it('removes a project from the list', async () => {
            const p1 = mockProject({ id: UUID_1 });
            const p2 = mockProject({ id: UUID_2 });
            useProjectStore.setState({ projects: [p1, p2] });

            mockedRepo.delete.mockResolvedValue(undefined);

            await useProjectStore.getState().deleteProject(UUID_1);

            const state = useProjectStore.getState();
            expect(state.projects).toHaveLength(1);
            expect(state.projects[0]!.id).toBe(UUID_2);
        });

        it('clears selectedProjectId when deleting selected project', async () => {
            const project = mockProject({ id: UUID_1 });
            useProjectStore.setState({
                projects: [project],
                selectedProjectId: UUID_1,
            });

            mockedRepo.delete.mockResolvedValue(undefined);

            await useProjectStore.getState().deleteProject(UUID_1);

            expect(useProjectStore.getState().selectedProjectId).toBeNull();
        });
    });

    describe('duplicateProject', () => {
        it('prepends duplicate to the list', async () => {
            const original = mockProject({ id: UUID_1, name: 'Original' });
            useProjectStore.setState({ projects: [original] });

            const duplicate = mockProject({ id: UUID_2, name: 'Original (Copy)' });
            mockedRepo.duplicate.mockResolvedValue(duplicate);

            const result = await useProjectStore.getState().duplicateProject(UUID_1);

            expect(result.name).toBe('Original (Copy)');
            expect(useProjectStore.getState().projects).toHaveLength(2);
            expect(useProjectStore.getState().projects[0]!.name).toBe('Original (Copy)');
        });
    });

    describe('toggleFavorite', () => {
        it('toggles isFavorite in the list', async () => {
            const project = mockProject({ id: UUID_1, isFavorite: false });
            useProjectStore.setState({ projects: [project] });

            const updated = mockProject({ id: UUID_1, isFavorite: true });
            mockedRepo.toggleFavorite.mockResolvedValue(updated);

            const result = await useProjectStore.getState().toggleFavorite(UUID_1);

            expect(result.isFavorite).toBe(true);
            expect(useProjectStore.getState().projects[0]!.isFavorite).toBe(true);
        });
    });

    describe('selectProject', () => {
        it('sets the selected project id', () => {
            useProjectStore.getState().selectProject(UUID_1);
            expect(useProjectStore.getState().selectedProjectId).toBe(UUID_1);
        });

        it('clears selection when null', () => {
            useProjectStore.setState({ selectedProjectId: UUID_1 });
            useProjectStore.getState().selectProject(null);
            expect(useProjectStore.getState().selectedProjectId).toBeNull();
        });
    });

    describe('setSearchQuery', () => {
        it('updates the search query', () => {
            useProjectStore.getState().setSearchQuery('test');
            expect(useProjectStore.getState().searchQuery).toBe('test');
        });
    });

    describe('getProjectById', () => {
        it('returns project from current state', () => {
            const project = mockProject({ id: UUID_1, name: 'Found' });
            useProjectStore.setState({ projects: [project] });

            const result = useProjectStore.getState().getProjectById(UUID_1);
            expect(result?.name).toBe('Found');
        });

        it('returns undefined when not found', () => {
            useProjectStore.setState({ projects: [] });

            const result = useProjectStore.getState().getProjectById('missing');
            expect(result).toBeUndefined();
        });
    });

    describe('clearError', () => {
        it('clears the error state', () => {
            useProjectStore.setState({
                error: AppError.database('Some error'),
            });

            useProjectStore.getState().clearError();
            expect(useProjectStore.getState().error).toBeNull();
        });
    });
});
