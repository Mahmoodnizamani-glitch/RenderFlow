/**
 * Tests for useSyncStore.
 *
 * Verifies state transitions for sync status, pending count, and error state.
 */
import { useSyncStore } from '../useSyncStore';

describe('useSyncStore', () => {
    beforeEach(() => {
        useSyncStore.getState().reset();
    });

    it('starts with idle status and no errors', () => {
        const state = useSyncStore.getState();

        expect(state.syncStatus).toBe('idle');
        expect(state.lastSyncedAt).toBeNull();
        expect(state.pendingCount).toBe(0);
        expect(state.errorMessage).toBeNull();
    });

    it('transitions to syncing status', () => {
        useSyncStore.getState().setSyncing();

        const state = useSyncStore.getState();
        expect(state.syncStatus).toBe('syncing');
        expect(state.errorMessage).toBeNull();
    });

    it('transitions to synced (idle) status with timestamp', () => {
        useSyncStore.getState().setSynced();

        const state = useSyncStore.getState();
        expect(state.syncStatus).toBe('idle');
        expect(state.lastSyncedAt).toBeInstanceOf(Date);
        expect(state.errorMessage).toBeNull();
    });

    it('transitions to offline status', () => {
        useSyncStore.getState().setOffline();

        const state = useSyncStore.getState();
        expect(state.syncStatus).toBe('offline');
    });

    it('transitions to error status with message', () => {
        useSyncStore.getState().setError('Network failed');

        const state = useSyncStore.getState();
        expect(state.syncStatus).toBe('error');
        expect(state.errorMessage).toBe('Network failed');
    });

    it('updates pending count', () => {
        useSyncStore.getState().setPendingCount(5);

        expect(useSyncStore.getState().pendingCount).toBe(5);
    });

    it('resets to initial state', () => {
        useSyncStore.getState().setSyncing();
        useSyncStore.getState().setPendingCount(3);
        useSyncStore.getState().setError('Error');

        useSyncStore.getState().reset();

        const state = useSyncStore.getState();
        expect(state.syncStatus).toBe('idle');
        expect(state.pendingCount).toBe(0);
        expect(state.errorMessage).toBeNull();
        expect(state.lastSyncedAt).toBeNull();
    });

    it('clears error when transitioning to syncing', () => {
        useSyncStore.getState().setError('Previous error');
        useSyncStore.getState().setSyncing();

        expect(useSyncStore.getState().errorMessage).toBeNull();
    });

    it('clears error when transitioning to synced', () => {
        useSyncStore.getState().setError('Previous error');
        useSyncStore.getState().setSynced();

        expect(useSyncStore.getState().errorMessage).toBeNull();
    });
});
