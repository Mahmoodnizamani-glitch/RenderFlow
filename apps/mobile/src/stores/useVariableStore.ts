/**
 * useVariableStore — Zustand store for variable injection state management.
 *
 * Manages variable definitions (parsed from code), current values,
 * and saved presets. Per-project values and presets are persisted in MMKV.
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { VariableDefinition, VariableValues } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// MMKV storage adapter
//
// react-native-mmkv exports MMKV as a class at runtime, but some TS
// declaration versions expose it as type-only. We use a dynamic require
// to construct the instance safely (matches usePreferences.ts pattern).
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MMKV: MMKVClass } = require('react-native-mmkv') as {
    MMKV: new (config?: { id?: string }) => {
        getString(key: string): string | undefined;
        set(key: string, value: string): void;
        delete(key: string): void;
    };
};

const variableStorage = new MMKVClass({ id: 'variable-storage' });

// ---------------------------------------------------------------------------
// Preset type
// ---------------------------------------------------------------------------

export interface VariablePreset {
    id: string;
    name: string;
    values: VariableValues;
    createdAt: string;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function valuesKey(projectId: string): string {
    return `variable-values:${projectId}`;
}

function presetsKey(projectId: string): string {
    return `variable-presets:${projectId}`;
}

function loadValues(projectId: string): VariableValues {
    const raw = variableStorage.getString(valuesKey(projectId));
    if (!raw) return {};
    try {
        return JSON.parse(raw) as VariableValues;
    } catch {
        return {};
    }
}

function saveValues(projectId: string, values: VariableValues): void {
    variableStorage.set(valuesKey(projectId), JSON.stringify(values));
}

function loadPresets(projectId: string): VariablePreset[] {
    const raw = variableStorage.getString(presetsKey(projectId));
    if (!raw) return [];
    try {
        return JSON.parse(raw) as VariablePreset[];
    } catch {
        return [];
    }
}

function savePresets(projectId: string, presets: VariablePreset[]): void {
    variableStorage.set(presetsKey(projectId), JSON.stringify(presets));
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface VariableState {
    /** Current project ID context */
    projectId: string | null;
    /** Parsed variable definitions from code */
    definitions: VariableDefinition[];
    /** Current variable values (name → value) */
    values: VariableValues;
    /** Saved presets for the current project */
    presets: VariablePreset[];
    /** Currently active preset ID (null if custom) */
    activePresetId: string | null;
}

interface VariableActions {
    /** Set the active project and load its persisted values/presets */
    setProject: (projectId: string) => void;
    /** Update the parsed variable definitions from code */
    setDefinitions: (definitions: VariableDefinition[]) => void;
    /** Update a single variable value */
    setValue: (name: string, value: unknown) => void;
    /** Reset all values to their defaults */
    resetToDefaults: () => void;
    /** Save current values as a named preset */
    savePreset: (name: string) => void;
    /** Load a saved preset by ID */
    loadPreset: (presetId: string) => void;
    /** Delete a saved preset by ID */
    deletePreset: (presetId: string) => void;
    /** Clear all state (when leaving project) */
    clearProject: () => void;
}

export type VariableStore = VariableState & VariableActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useVariableStore = create<VariableStore>()(
    immer((set, get) => ({
        // State
        projectId: null,
        definitions: [],
        values: {},
        presets: [],
        activePresetId: null,

        // Actions
        setProject: (projectId: string) => {
            const values = loadValues(projectId);
            const presets = loadPresets(projectId);
            set((state) => {
                state.projectId = projectId;
                state.values = values;
                state.presets = presets;
                state.activePresetId = null;
            });
        },

        setDefinitions: (definitions: VariableDefinition[]) => {
            set((state) => {
                state.definitions = definitions;

                // Initialize values for new definitions that don't have a value yet
                for (const def of definitions) {
                    if (state.values[def.name] === undefined && def.defaultValue !== undefined) {
                        state.values[def.name] = def.defaultValue;
                    }
                }
            });
        },

        setValue: (name: string, value: unknown) => {
            set((state) => {
                state.values[name] = value;
                state.activePresetId = null;
            });

            // Persist after state update
            const { projectId, values } = get();
            if (projectId) {
                saveValues(projectId, values);
            }
        },

        resetToDefaults: () => {
            set((state) => {
                const defaults: VariableValues = {};
                for (const def of state.definitions) {
                    if (def.defaultValue !== undefined) {
                        defaults[def.name] = def.defaultValue;
                    }
                }
                state.values = defaults;
                state.activePresetId = null;
            });

            const { projectId, values } = get();
            if (projectId) {
                saveValues(projectId, values);
            }
        },

        savePreset: (name: string) => {
            const id = `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const preset: VariablePreset = {
                id,
                name,
                values: { ...get().values },
                createdAt: new Date().toISOString(),
            };

            set((state) => {
                state.presets.push(preset);
                state.activePresetId = id;
            });

            const { projectId, presets } = get();
            if (projectId) {
                savePresets(projectId, presets);
            }
        },

        loadPreset: (presetId: string) => {
            const { presets } = get();
            const preset = presets.find((p) => p.id === presetId);
            if (!preset) return;

            set((state) => {
                state.values = { ...preset.values };
                state.activePresetId = presetId;
            });

            const { projectId, values } = get();
            if (projectId) {
                saveValues(projectId, values);
            }
        },

        deletePreset: (presetId: string) => {
            set((state) => {
                state.presets = state.presets.filter((p) => p.id !== presetId);
                if (state.activePresetId === presetId) {
                    state.activePresetId = null;
                }
            });

            const { projectId, presets } = get();
            if (projectId) {
                savePresets(projectId, presets);
            }
        },

        clearProject: () => {
            set((state) => {
                state.projectId = null;
                state.definitions = [];
                state.values = {};
                state.presets = [];
                state.activePresetId = null;
            });
        },
    })),
);
