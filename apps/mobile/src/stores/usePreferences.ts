/**
 * Preferences store — persisted via MMKV.
 *
 * Stores user preferences like view mode (grid/list) that need to
 * survive app restarts. Uses Zustand with persist middleware backed
 * by react-native-mmkv.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// MMKV storage adapter
//
// react-native-mmkv exports MMKV as a class at runtime, but some TS
// declaration versions expose it as type-only. We use a dynamic require
// to construct the instance safely.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MMKV: MMKVClass } = require('react-native-mmkv') as {
    MMKV: new (config?: { id?: string }) => {
        getString(key: string): string | undefined;
        set(key: string, value: string): void;
        delete(key: string): void;
    };
};

const storage = new MMKVClass({ id: 'renderflow-preferences' });

// Zustand persist storage adapter for MMKV
const mmkvStorage = {
    getItem: (name: string): string | null => {
        return storage.getString(name) ?? null;
    },
    setItem: (name: string, value: string): void => {
        storage.set(name, value);
    },
    removeItem: (name: string): void => {
        storage.delete(name);
    },
};

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export type ViewMode = 'grid' | 'list';

interface PreferencesState {
    viewMode: ViewMode;
}

interface PreferencesActions {
    setViewMode: (mode: ViewMode) => void;
    toggleViewMode: () => void;
}

export type PreferencesStore = PreferencesState & PreferencesActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePreferences = create<PreferencesStore>()(
    persist(
        (set) => ({
            viewMode: 'grid',

            setViewMode: (mode: ViewMode) => {
                set({ viewMode: mode });
            },

            toggleViewMode: () => {
                set((state) => ({
                    viewMode: state.viewMode === 'grid' ? 'list' : 'grid',
                }));
            },
        }),
        {
            name: 'preferences',
            storage: createJSONStorage(() => mmkvStorage),
        },
    ),
);
