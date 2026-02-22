/**
 * Zustand store for sync UI state.
 *
 * Tracks the current sync status, last synced timestamp,
 * and count of pending sync actions for UI display.
 */
import { create } from 'zustand';
import type { SyncStatus } from './SyncManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncState {
    syncStatus: SyncStatus;
    lastSyncedAt: Date | null;
    pendingCount: number;
    errorMessage: string | null;
}

interface SyncActions {
    setSyncing: () => void;
    setSynced: () => void;
    setOffline: () => void;
    setError: (message: string) => void;
    setPendingCount: (count: number) => void;
    reset: () => void;
}

export type SyncStore = SyncState & SyncActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const INITIAL_STATE: SyncState = {
    syncStatus: 'idle',
    lastSyncedAt: null,
    pendingCount: 0,
    errorMessage: null,
};

export const useSyncStore = create<SyncStore>()((set) => ({
    ...INITIAL_STATE,

    setSyncing: () => {
        set({ syncStatus: 'syncing', errorMessage: null });
    },

    setSynced: () => {
        set({
            syncStatus: 'idle',
            lastSyncedAt: new Date(),
            errorMessage: null,
        });
    },

    setOffline: () => {
        set({ syncStatus: 'offline' });
    },

    setError: (message: string) => {
        set({ syncStatus: 'error', errorMessage: message });
    },

    setPendingCount: (count: number) => {
        set({ pendingCount: count });
    },

    reset: () => {
        set(INITIAL_STATE);
    },
}));
