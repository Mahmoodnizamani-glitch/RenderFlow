/**
 * Project service unit tests.
 *
 * Tests CRUD, duplication, and ownership checks with mocked database.
 * The mock must handle chained Drizzle calls:
 *   db.select().from().where().limit()   → getProjectById
 *   db.update().set().where().returning() → updateProject
 *   db.delete().where()                   → deleteProject
 *   db.insert().values().returning()      → createProject / duplicateProject
 */
import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock database row
// ---------------------------------------------------------------------------

interface MockProjectRow {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    code: string | null;
    thumbnailUrl: string | null;
    compositionSettings: Record<string, unknown>;
    variables: Record<string, unknown>;
    isTemplate: boolean;
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
}

function createMockProjectRow(overrides?: Partial<MockProjectRow>): MockProjectRow {
    return {
        id: 'proj-001',
        userId: 'user-123',
        name: 'Test Project',
        description: 'A test project',
        code: 'export default () => null;',
        thumbnailUrl: null,
        compositionSettings: { width: 1920, height: 1080, fps: 30 },
        variables: {},
        isTemplate: false,
        isPublic: false,
        createdAt: new Date('2026-01-15T12:00:00Z'),
        updatedAt: new Date('2026-01-15T12:00:00Z'),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Chainable mock DB factory
// ---------------------------------------------------------------------------

function createChainableMockDb(options: {
    selectResult?: MockProjectRow[];
    insertResult?: MockProjectRow[];
    updateResult?: MockProjectRow[];
}) {
    const selectResult = options.selectResult ?? [createMockProjectRow()];
    const insertResult = options.insertResult ?? [createMockProjectRow()];
    const updateResult = options.updateResult ?? [createMockProjectRow()];

    // Select chain: select → from → where → limit
    const selectChain = {
        from: vi.fn(() => selectChain),
        where: vi.fn(() => selectChain),
        limit: vi.fn(() => Promise.resolve(selectResult)),
    };

    // Insert chain: insert → values → returning
    const insertChain = {
        values: vi.fn(() => insertChain),
        returning: vi.fn(() => Promise.resolve(insertResult)),
    };

    // Update chain: update → set → where → returning
    const updateChain = {
        set: vi.fn(() => updateChain),
        where: vi.fn(() => updateChain),
        returning: vi.fn(() => Promise.resolve(updateResult)),
    };

    // Delete chain: delete → where
    const deleteChain = {
        where: vi.fn(() => Promise.resolve()),
    };

    return {
        select: vi.fn(() => selectChain),
        insert: vi.fn(() => insertChain),
        update: vi.fn(() => updateChain),
        delete: vi.fn(() => deleteChain),
        // Expose chains for assertions
        _selectChain: selectChain,
        _insertChain: insertChain,
        _updateChain: updateChain,
        _deleteChain: deleteChain,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('project service', () => {
    describe('createProject', () => {
        it('inserts a project and returns the row', async () => {
            const db = createChainableMockDb({
                insertResult: [createMockProjectRow()],
            });

            const { createProject } = await import('../project.service.js');

            const result = await createProject(db as never, 'user-123', {
                name: 'New Project',
                description: 'A new project',
            });

            expect(db.insert).toHaveBeenCalledOnce();
            expect(result.name).toBe('Test Project');
            expect(result.userId).toBe('user-123');
        });

        it('throws when insert returns no rows', async () => {
            const db = createChainableMockDb({ insertResult: [] });
            const { createProject } = await import('../project.service.js');

            await expect(
                createProject(db as never, 'user-123', { name: 'Fail' }),
            ).rejects.toThrow(/failed/i);
        });
    });

    describe('getProjectById', () => {
        it('returns the project for the owning user', async () => {
            const db = createChainableMockDb({
                selectResult: [createMockProjectRow()],
            });
            const { getProjectById } = await import('../project.service.js');

            const result = await getProjectById(db as never, 'proj-001', 'user-123');

            expect(result.id).toBe('proj-001');
        });

        it('throws not found when no project matches', async () => {
            const db = createChainableMockDb({ selectResult: [] });
            const { getProjectById } = await import('../project.service.js');

            await expect(
                getProjectById(db as never, 'nonexistent', 'user-123'),
            ).rejects.toThrow(/not found/i);
        });
    });

    describe('updateProject', () => {
        it('updates name and returns updated row', async () => {
            const db = createChainableMockDb({
                selectResult: [createMockProjectRow()], // getProjectById passes
                updateResult: [createMockProjectRow({ name: 'Updated Name' })],
            });
            const { updateProject } = await import('../project.service.js');

            const result = await updateProject(db as never, 'proj-001', 'user-123', {
                name: 'Updated Name',
            });

            expect(db.update).toHaveBeenCalledOnce();
            expect(result.name).toBe('Updated Name');
        });

        it('throws not found when project does not exist (ownership check)', async () => {
            const db = createChainableMockDb({
                selectResult: [], // getProjectById fails
            });
            const { updateProject } = await import('../project.service.js');

            await expect(
                updateProject(db as never, 'nonexistent', 'user-123', { name: 'X' }),
            ).rejects.toThrow(/not found/i);
        });

        it('throws when update returns no rows despite ownership check passing', async () => {
            const db = createChainableMockDb({
                selectResult: [createMockProjectRow()],
                updateResult: [],
            });
            const { updateProject } = await import('../project.service.js');

            await expect(
                updateProject(db as never, 'proj-001', 'user-123', { name: 'X' }),
            ).rejects.toThrow(/failed/i);
        });
    });

    describe('deleteProject', () => {
        it('deletes a project by id and user', async () => {
            const db = createChainableMockDb({
                selectResult: [createMockProjectRow()], // getProjectById passes
            });
            const { deleteProject } = await import('../project.service.js');

            await expect(
                deleteProject(db as never, 'proj-001', 'user-123'),
            ).resolves.toBeUndefined();

            expect(db.delete).toHaveBeenCalledOnce();
        });

        it('throws not found when project does not exist', async () => {
            const db = createChainableMockDb({ selectResult: [] });
            const { deleteProject } = await import('../project.service.js');

            await expect(
                deleteProject(db as never, 'nonexistent', 'user-123'),
            ).rejects.toThrow(/not found/i);
        });
    });

    describe('duplicateProject', () => {
        it('duplicates a project for the same user', async () => {
            const db = createChainableMockDb({
                selectResult: [createMockProjectRow()], // getProjectById passes
                insertResult: [createMockProjectRow({ id: 'proj-002', name: 'Test Project (copy)' })],
            });
            const { duplicateProject } = await import('../project.service.js');

            const result = await duplicateProject(db as never, 'proj-001', 'user-123');

            expect(result.id).toBe('proj-002');
            expect(result.name).toBe('Test Project (copy)');
        });

        it('throws not found when source project does not exist', async () => {
            const db = createChainableMockDb({ selectResult: [] });
            const { duplicateProject } = await import('../project.service.js');

            await expect(
                duplicateProject(db as never, 'nonexistent', 'user-123'),
            ).rejects.toThrow(/not found/i);
        });
    });
});
