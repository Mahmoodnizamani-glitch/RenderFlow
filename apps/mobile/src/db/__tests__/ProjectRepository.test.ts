/**
 * Tests for ProjectRepository.
 *
 * Mocks the Drizzle database layer to verify repository logic:
 * CRUD operations, search, duplicate, toggleFavorite, and error handling.
 */
import type { Project } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Mock setup — must come before imports that use the modules
// ---------------------------------------------------------------------------

const MOCK_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';

// Chain builder for select
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

function createDeleteChain() {
    return {
        where: jest.fn().mockResolvedValue(undefined),
    };
}

jest.mock('expo-crypto', () => ({
    randomUUID: jest.fn(() => MOCK_UUID),
}));

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

import { ProjectRepository } from '../repositories/ProjectRepository';
import { getDb } from '../client';
import { AppError, ErrorCode } from '../../errors/AppError';

interface MockDb {
    insert: jest.Mock;
    select: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockProject(overrides: Partial<Project> = {}): Project {
    return {
        id: MOCK_UUID,
        name: 'Test Project',
        description: 'A test project',
        code: 'export default () => <div>Hello</div>',
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

function getDbMock(): MockDb {
    return (getDb as jest.Mock)() as MockDb;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectRepository', () => {
    let db: MockDb;

    beforeEach(() => {
        jest.clearAllMocks();
        db = getDbMock();
    });

    describe('create', () => {
        it('creates a project with generated UUID and timestamps', async () => {
            const insertChain = createInsertChain();
            db.insert.mockReturnValue(insertChain);

            const project = mockProject();
            const selectChain = createSelectChain([{
                ...project,
                variables: JSON.stringify(project.variables),
            }]);
            db.select.mockReturnValue(selectChain);

            const result = await ProjectRepository.create({ name: 'Test Project' });

            expect(db.insert).toHaveBeenCalled();
            expect(insertChain.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: MOCK_UUID,
                    name: 'Test Project',
                    description: '',
                    code: '',
                }),
            );
            expect(result.id).toBe(MOCK_UUID);
            expect(result.name).toBe('Test Project');
        });

        it('creates a project with all provided fields', async () => {
            const insertChain = createInsertChain();
            db.insert.mockReturnValue(insertChain);

            const input = {
                name: 'Full Project',
                description: 'Full description',
                code: 'const x = 1;',
                compositionWidth: 3840,
                compositionHeight: 2160,
                fps: 60,
                durationInFrames: 300,
                variables: { color: '#ff0000' },
            };

            const project = mockProject({
                ...input,
            });
            const selectChain = createSelectChain([{
                ...project,
                variables: JSON.stringify(input.variables),
            }]);
            db.select.mockReturnValue(selectChain);

            const result = await ProjectRepository.create(input);

            expect(insertChain.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Full Project',
                    compositionWidth: 3840,
                    fps: 60,
                    variables: JSON.stringify({ color: '#ff0000' }),
                }),
            );
            expect(result.name).toBe('Full Project');
        });

        it('throws AppError on database failure', async () => {
            const insertChain = {
                values: jest.fn().mockRejectedValue(new Error('DB write failed')),
            };
            db.insert.mockReturnValue(insertChain);

            await expect(ProjectRepository.create({ name: 'Fail' })).rejects.toThrow(AppError);
            await expect(ProjectRepository.create({ name: 'Fail' })).rejects.toMatchObject({
                code: ErrorCode.DATABASE_ERROR,
            });
        });
    });

    describe('getById', () => {
        it('returns a project when found', async () => {
            const project = mockProject();
            const selectChain = createSelectChain([{
                ...project,
                variables: JSON.stringify(project.variables),
            }]);
            db.select.mockReturnValue(selectChain);

            const result = await ProjectRepository.getById(MOCK_UUID);

            expect(result.id).toBe(MOCK_UUID);
            expect(result.name).toBe('Test Project');
        });

        it('throws NOT_FOUND when project does not exist', async () => {
            const selectChain = createSelectChain([]);
            db.select.mockReturnValue(selectChain);

            await expect(ProjectRepository.getById('nonexistent')).rejects.toThrow(AppError);
            await expect(ProjectRepository.getById('nonexistent')).rejects.toMatchObject({
                code: ErrorCode.NOT_FOUND,
            });
        });
    });

    describe('getAll', () => {
        it('returns all projects', async () => {
            const p1 = mockProject({ id: UUID_1, name: 'Project A' });
            const p2 = mockProject({ id: UUID_2, name: 'Project B' });
            const selectChain = createSelectChain([
                { ...p1, variables: '{}' },
                { ...p2, variables: '{}' },
            ]);
            db.select.mockReturnValue(selectChain);

            const results = await ProjectRepository.getAll();

            expect(results).toHaveLength(2);
        });

        it('returns empty array when no projects exist', async () => {
            const selectChain = createSelectChain([]);
            db.select.mockReturnValue(selectChain);

            const results = await ProjectRepository.getAll();

            expect(results).toHaveLength(0);
        });
    });

    describe('update', () => {
        it('updates project fields and returns updated project', async () => {
            const original = mockProject();
            const updated = mockProject({ name: 'Updated Name' });

            let selectCallCount = 0;
            db.select.mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount <= 1) {
                    return createSelectChain([{ ...original, variables: JSON.stringify(original.variables) }]);
                }
                return createSelectChain([{ ...updated, variables: JSON.stringify(updated.variables) }]);
            });

            const updateChain = createUpdateChain();
            db.update.mockReturnValue(updateChain);

            const result = await ProjectRepository.update(MOCK_UUID, { name: 'Updated Name' });

            expect(db.update).toHaveBeenCalled();
            expect(result.name).toBe('Updated Name');
        });

        it('throws NOT_FOUND when updating nonexistent project', async () => {
            db.select.mockReturnValue(createSelectChain([]));

            await expect(
                ProjectRepository.update('nonexistent', { name: 'Nope' }),
            ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
        });
    });

    describe('delete', () => {
        it('deletes an existing project', async () => {
            const project = mockProject();
            db.select.mockReturnValue(
                createSelectChain([{ ...project, variables: JSON.stringify(project.variables) }]),
            );
            db.delete.mockReturnValue(createDeleteChain());

            await expect(ProjectRepository.delete(MOCK_UUID)).resolves.toBeUndefined();
            expect(db.delete).toHaveBeenCalled();
        });

        it('throws NOT_FOUND when deleting nonexistent project', async () => {
            db.select.mockReturnValue(createSelectChain([]));

            await expect(ProjectRepository.delete('nonexistent')).rejects.toMatchObject({
                code: ErrorCode.NOT_FOUND,
            });
        });
    });

    describe('duplicate', () => {
        it('creates a copy with "(Copy)" suffix', async () => {
            const original = mockProject({ name: 'Original' });
            const copy = mockProject({ name: 'Original (Copy)', id: UUID_1 });

            const insertChain = createInsertChain();

            let selectCallCount = 0;
            db.select.mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount <= 1) {
                    return createSelectChain([{ ...original, variables: JSON.stringify(original.variables) }]);
                }
                return createSelectChain([{ ...copy, variables: JSON.stringify(copy.variables) }]);
            });
            db.insert.mockReturnValue(insertChain);

            const result = await ProjectRepository.duplicate(MOCK_UUID);

            expect(result.name).toBe('Original (Copy)');
            expect(insertChain.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Original (Copy)',
                }),
            );
        });
    });

    describe('toggleFavorite', () => {
        it('flips isFavorite from false to true', async () => {
            const project = mockProject({ isFavorite: false });
            const updated = mockProject({ isFavorite: true });

            let selectCallCount = 0;
            db.select.mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount <= 2) {
                    return createSelectChain([{ ...project, variables: JSON.stringify(project.variables) }]);
                }
                return createSelectChain([{ ...updated, variables: JSON.stringify(updated.variables) }]);
            });

            db.update.mockReturnValue(createUpdateChain());

            const result = await ProjectRepository.toggleFavorite(MOCK_UUID);

            expect(result.isFavorite).toBe(true);
        });
    });

    describe('search', () => {
        it('delegates to getAll with search option', async () => {
            db.select.mockReturnValue(createSelectChain([]));

            const results = await ProjectRepository.search('test query');

            expect(results).toHaveLength(0);
            expect(db.select).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns project count', async () => {
            db.select.mockReturnValue(createSelectChain([{ count: 5 }]));

            const result = await ProjectRepository.count();

            expect(result).toBe(5);
        });
    });
});
