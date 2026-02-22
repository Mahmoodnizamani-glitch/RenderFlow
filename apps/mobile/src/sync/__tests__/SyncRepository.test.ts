/**
 * Tests for SyncRepository.
 *
 * Mocks the Drizzle database to verify sync queue CRUD operations,
 * dedup logic, retry counting, and conflict marking.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsert = jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) });
const mockUpdate = jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
    }),
});
const mockDeleteFn = jest.fn().mockReturnValue({
    where: jest.fn().mockResolvedValue(undefined),
});
const mockSelect = jest.fn();

jest.mock('../../db/client', () => ({
    getDb: jest.fn(() => ({
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDeleteFn,
        select: mockSelect,
    })),
}));

jest.mock('expo-crypto', () => ({
    randomUUID: jest.fn(() => 'test-uuid-1234'),
}));

import { SyncRepository } from '../SyncRepository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupSelectMock(rows: unknown[]): void {
    const whereMock = jest.fn().mockReturnValue({
        orderBy: jest.fn().mockResolvedValue(rows),
        limit: jest.fn().mockResolvedValue(rows),
    });
    // For getPendingCount, where() returns a thenable (the rows directly)
    whereMock.mockReturnValue({
        orderBy: jest.fn().mockResolvedValue(rows),
        limit: jest.fn().mockResolvedValue(rows),
        then: (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve),
    });
    mockSelect.mockReturnValue({
        from: jest.fn().mockReturnValue({
            where: whereMock,
            orderBy: jest.fn().mockResolvedValue(rows),
            limit: jest.fn().mockResolvedValue(rows),
        }),
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncRepository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('enqueue', () => {
        it('creates a new pending sync action when none exists', async () => {
            // First select returns empty (no existing action)
            setupSelectMock([]);

            const result = await SyncRepository.enqueue(
                'project',
                'entity-1',
                'create',
                '{"name":"Test"}',
            );

            expect(result.entityType).toBe('project');
            expect(result.entityId).toBe('entity-1');
            expect(result.changeType).toBe('create');
            expect(result.status).toBe('pending');
            expect(mockInsert).toHaveBeenCalled();
        });

        it('updates existing pending action with new payload', async () => {
            const existingAction = {
                id: 'existing-1',
                entityType: 'project',
                entityId: 'entity-1',
                changeType: 'create',
                payload: '{"name":"Old"}',
                retryCount: 0,
                status: 'pending',
                errorMessage: null,
                createdAt: '2026-01-01T00:00:00.000Z',
            };

            setupSelectMock([existingAction]);

            const result = await SyncRepository.enqueue(
                'project',
                'entity-1',
                'update',
                '{"name":"New"}',
            );

            expect(result.changeType).toBe('update');
            expect(result.payload).toBe('{"name":"New"}');
            expect(mockUpdate).toHaveBeenCalled();
        });

        it('removes pending create when delete is enqueued', async () => {
            const existingCreate = {
                id: 'existing-1',
                entityType: 'project',
                entityId: 'entity-1',
                changeType: 'create',
                payload: '{}',
                retryCount: 0,
                status: 'pending',
                errorMessage: null,
                createdAt: '2026-01-01T00:00:00.000Z',
            };

            setupSelectMock([existingCreate]);

            const result = await SyncRepository.enqueue(
                'project',
                'entity-1',
                'delete',
                '{}',
            );

            expect(result.changeType).toBe('delete');
            expect(mockDeleteFn).toHaveBeenCalled();
        });
    });

    describe('getPendingActions', () => {
        it('returns actions ordered by createdAt', async () => {
            const actions = [
                {
                    id: 'action-1',
                    entityType: 'project',
                    entityId: 'e1',
                    changeType: 'create',
                    payload: '{}',
                    retryCount: 0,
                    status: 'pending',
                    errorMessage: null,
                    createdAt: '2026-01-01T00:00:00.000Z',
                },
                {
                    id: 'action-2',
                    entityType: 'project',
                    entityId: 'e2',
                    changeType: 'update',
                    payload: '{}',
                    retryCount: 0,
                    status: 'pending',
                    errorMessage: null,
                    createdAt: '2026-01-02T00:00:00.000Z',
                },
            ];

            setupSelectMock(actions);

            const result = await SyncRepository.getPendingActions();

            expect(result).toHaveLength(2);
            expect(result[0]!.id).toBe('action-1');
            expect(result[1]!.id).toBe('action-2');
        });
    });

    describe('incrementRetry', () => {
        it('increments retry count and keeps status pending', async () => {
            const action = {
                id: 'action-1',
                entityType: 'project',
                entityId: 'e1',
                changeType: 'create',
                payload: '{}',
                retryCount: 0,
                status: 'pending',
                errorMessage: null,
                createdAt: '2026-01-01T00:00:00.000Z',
            };

            setupSelectMock([action]);

            const newCount = await SyncRepository.incrementRetry('action-1');

            expect(newCount).toBe(1);
            expect(mockUpdate).toHaveBeenCalled();
        });

        it('marks as conflict when max retries exceeded', async () => {
            const action = {
                id: 'action-1',
                entityType: 'project',
                entityId: 'e1',
                changeType: 'create',
                payload: '{}',
                retryCount: 2,
                status: 'pending',
                errorMessage: null,
                createdAt: '2026-01-01T00:00:00.000Z',
            };

            setupSelectMock([action]);

            const newCount = await SyncRepository.incrementRetry('action-1');

            expect(newCount).toBe(3);
            expect(mockUpdate).toHaveBeenCalled();
        });

        it('returns 0 for non-existent action', async () => {
            setupSelectMock([]);

            const result = await SyncRepository.incrementRetry('missing');
            expect(result).toBe(0);
        });
    });

    describe('clearAll', () => {
        it('deletes all sync actions', async () => {
            await SyncRepository.clearAll();
            expect(mockDeleteFn).toHaveBeenCalled();
        });
    });

    describe('markInProgress', () => {
        it('updates action status to in_progress', async () => {
            await SyncRepository.markInProgress('action-1');
            expect(mockUpdate).toHaveBeenCalled();
        });
    });

    describe('markFailed', () => {
        it('updates action status to failed with error message', async () => {
            await SyncRepository.markFailed('action-1', 'Network error');
            expect(mockUpdate).toHaveBeenCalled();
        });
    });

    describe('markConflict', () => {
        it('updates action status to conflict', async () => {
            await SyncRepository.markConflict('action-1', 'Max retries');
            expect(mockUpdate).toHaveBeenCalled();
        });
    });

    describe('getPendingCount', () => {
        it('returns the count of pending actions', async () => {
            setupSelectMock([{ id: '1' }, { id: '2' }]);

            const count = await SyncRepository.getPendingCount();
            expect(count).toBe(2);
        });
    });
});
