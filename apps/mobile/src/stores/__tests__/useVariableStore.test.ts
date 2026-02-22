/**
 * useVariableStore.test.ts — unit tests for the variable injection store.
 */
import { useVariableStore } from '../useVariableStore';
import type { VariableDefinition } from '@renderflow/shared';

describe('useVariableStore', () => {
    beforeEach(() => {
        // Reset to initial state before each test
        useVariableStore.setState({
            projectId: null,
            definitions: [],
            values: {},
            presets: [],
            activePresetId: null,
        });
    });

    // ---------------------------------------------------------------------------
    // setProject
    // ---------------------------------------------------------------------------

    describe('setProject', () => {
        it('sets the project ID', () => {
            useVariableStore.getState().setProject('project-1');
            expect(useVariableStore.getState().projectId).toBe('project-1');
        });

        it('resets activePresetId', () => {
            useVariableStore.setState({ activePresetId: 'some-preset' });
            useVariableStore.getState().setProject('project-1');
            expect(useVariableStore.getState().activePresetId).toBeNull();
        });
    });

    // ---------------------------------------------------------------------------
    // setDefinitions
    // ---------------------------------------------------------------------------

    describe('setDefinitions', () => {
        const defs: VariableDefinition[] = [
            { name: 'title', type: 'string', label: 'Title', defaultValue: 'Hello' },
            { name: 'count', type: 'number', label: 'Count', defaultValue: 5 },
        ];

        it('stores definitions', () => {
            useVariableStore.getState().setDefinitions(defs);
            expect(useVariableStore.getState().definitions).toEqual(defs);
        });

        it('initializes values from defaults when no existing value', () => {
            useVariableStore.getState().setDefinitions(defs);
            const values = useVariableStore.getState().values;
            expect(values.title).toBe('Hello');
            expect(values.count).toBe(5);
        });

        it('preserves existing values and does not override', () => {
            useVariableStore.setState({ values: { title: 'Override' } });
            useVariableStore.getState().setDefinitions(defs);
            const values = useVariableStore.getState().values;
            expect(values.title).toBe('Override');
            expect(values.count).toBe(5);
        });
    });

    // ---------------------------------------------------------------------------
    // setValue
    // ---------------------------------------------------------------------------

    describe('setValue', () => {
        it('sets a value by name', () => {
            useVariableStore.getState().setValue('foo', 'bar');
            expect(useVariableStore.getState().values.foo).toBe('bar');
        });

        it('clears activePresetId when a value changes', () => {
            useVariableStore.setState({ activePresetId: 'preset-1' });
            useVariableStore.getState().setValue('x', 1);
            expect(useVariableStore.getState().activePresetId).toBeNull();
        });

        it('overwrites existing value', () => {
            useVariableStore.setState({ values: { a: 1 } });
            useVariableStore.getState().setValue('a', 2);
            expect(useVariableStore.getState().values.a).toBe(2);
        });
    });

    // ---------------------------------------------------------------------------
    // resetToDefaults
    // ---------------------------------------------------------------------------

    describe('resetToDefaults', () => {
        const defs: VariableDefinition[] = [
            { name: 'x', type: 'number', label: 'X', defaultValue: 10 },
            { name: 'y', type: 'string', label: 'Y', defaultValue: 'default' },
            { name: 'z', type: 'boolean', label: 'Z' }, // no default
        ];

        it('resets values to definition defaults', () => {
            useVariableStore.getState().setDefinitions(defs);
            useVariableStore.getState().setValue('x', 999);
            useVariableStore.getState().setValue('y', 'custom');
            useVariableStore.getState().resetToDefaults();

            const values = useVariableStore.getState().values;
            expect(values.x).toBe(10);
            expect(values.y).toBe('default');
            expect(values.z).toBeUndefined();
        });

        it('clears activePresetId', () => {
            useVariableStore.setState({
                activePresetId: 'some',
                definitions: defs,
            });
            useVariableStore.getState().resetToDefaults();
            expect(useVariableStore.getState().activePresetId).toBeNull();
        });
    });

    // ---------------------------------------------------------------------------
    // Presets
    // ---------------------------------------------------------------------------

    describe('savePreset', () => {
        it('creates a preset with current values', () => {
            useVariableStore.setState({ values: { color: '#FF0000' } });
            useVariableStore.getState().savePreset('My Red');

            const presets = useVariableStore.getState().presets;
            expect(presets).toHaveLength(1);
            expect(presets[0]!.name).toBe('My Red');
            expect(presets[0]!.values).toEqual({ color: '#FF0000' });
        });

        it('sets activePresetId to the new preset', () => {
            useVariableStore.getState().savePreset('Preset');
            const state = useVariableStore.getState();
            expect(state.activePresetId).toBe(state.presets[0]!.id);
        });
    });

    describe('loadPreset', () => {
        it('restores values from a saved preset', () => {
            useVariableStore.setState({ values: { a: 1 } });
            useVariableStore.getState().savePreset('Saved');
            const presetId = useVariableStore.getState().presets[0]!.id;

            useVariableStore.getState().setValue('a', 999);
            useVariableStore.getState().loadPreset(presetId);

            expect(useVariableStore.getState().values.a).toBe(1);
            expect(useVariableStore.getState().activePresetId).toBe(presetId);
        });

        it('does nothing for non-existent preset ID', () => {
            useVariableStore.setState({ values: { a: 1 } });
            useVariableStore.getState().loadPreset('non-existent');
            expect(useVariableStore.getState().values.a).toBe(1);
        });
    });

    describe('deletePreset', () => {
        it('removes a preset by ID', () => {
            useVariableStore.getState().savePreset('To Delete');
            const presetId = useVariableStore.getState().presets[0]!.id;
            useVariableStore.getState().deletePreset(presetId);
            expect(useVariableStore.getState().presets).toHaveLength(0);
        });

        it('clears activePresetId if the active preset is deleted', () => {
            useVariableStore.getState().savePreset('Active');
            const presetId = useVariableStore.getState().presets[0]!.id;
            expect(useVariableStore.getState().activePresetId).toBe(presetId);

            useVariableStore.getState().deletePreset(presetId);
            expect(useVariableStore.getState().activePresetId).toBeNull();
        });
    });

    // ---------------------------------------------------------------------------
    // clearProject
    // ---------------------------------------------------------------------------

    describe('clearProject', () => {
        it('resets all state to initial values', () => {
            useVariableStore.setState({
                projectId: 'p1',
                definitions: [
                    { name: 'x', type: 'number', label: 'X' },
                ],
                values: { x: 42 },
                presets: [{ id: '1', name: 'p', values: {}, createdAt: '' }],
                activePresetId: '1',
            });

            useVariableStore.getState().clearProject();
            const state = useVariableStore.getState();
            expect(state.projectId).toBeNull();
            expect(state.definitions).toEqual([]);
            expect(state.values).toEqual({});
            expect(state.presets).toEqual([]);
            expect(state.activePresetId).toBeNull();
        });
    });
});
