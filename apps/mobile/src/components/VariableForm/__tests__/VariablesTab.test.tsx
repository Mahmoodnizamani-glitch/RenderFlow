/**
 * VariablesTab.test.tsx — tests for the Variables tab container.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VariablesTab } from '../VariablesTab';
import { useVariableStore } from '../../../stores/useVariableStore';
import { TestWrapper } from '../../__tests__/testUtils';
import type { VariableDefinition } from '@renderflow/shared';

// Helpers
const wrap = (ui: React.ReactElement) => render(ui, { wrapper: TestWrapper });

describe('VariablesTab', () => {
    beforeEach(() => {
        // Reset store state
        useVariableStore.setState({
            projectId: null,
            definitions: [],
            values: {},
            presets: [],
            activePresetId: null,
        });
    });

    it('shows empty state when no definitions exist', () => {
        const { getByTestId } = wrap(<VariablesTab testID="vt" />);
        expect(getByTestId('vt-empty')).toBeTruthy();
    });

    it('shows the form when definitions exist', () => {
        const defs: VariableDefinition[] = [
            { name: 'title', type: 'string', label: 'Title', defaultValue: 'Hello' },
        ];
        useVariableStore.setState({
            definitions: defs,
            values: { title: 'Hello' },
        });

        const { getByTestId } = wrap(<VariablesTab testID="vt" />);
        expect(getByTestId('vt-form')).toBeTruthy();
    });

    it('shows reset button when definitions exist', () => {
        const defs: VariableDefinition[] = [
            { name: 'x', type: 'number', label: 'X', defaultValue: 10 },
        ];
        useVariableStore.setState({
            definitions: defs,
            values: { x: 42 },
        });

        const { getByTestId } = wrap(<VariablesTab testID="vt" />);
        expect(getByTestId('vt-reset')).toBeTruthy();
    });

    it('calls resetToDefaults when reset button is pressed', () => {
        const defs: VariableDefinition[] = [
            { name: 'x', type: 'number', label: 'X', defaultValue: 10 },
        ];
        useVariableStore.setState({
            definitions: defs,
            values: { x: 42 },
        });

        const { getByTestId } = wrap(<VariablesTab testID="vt" />);
        fireEvent.press(getByTestId('vt-reset'));

        // After reset, values should contain defaults
        const state = useVariableStore.getState();
        expect(state.values.x).toBe(10);
    });

    it('shows save preset button', () => {
        const defs: VariableDefinition[] = [
            { name: 'y', type: 'string', label: 'Y' },
        ];
        useVariableStore.setState({
            definitions: defs,
            values: { y: 'test' },
        });

        const { getByTestId } = wrap(<VariablesTab testID="vt" />);
        expect(getByTestId('vt-save-preset-btn')).toBeTruthy();
    });

    it('shows preset input when save preset button is pressed', () => {
        const defs: VariableDefinition[] = [
            { name: 'z', type: 'string', label: 'Z' },
        ];
        useVariableStore.setState({
            definitions: defs,
            values: { z: 'val' },
        });

        const { getByTestId } = wrap(<VariablesTab testID="vt" />);
        fireEvent.press(getByTestId('vt-save-preset-btn'));
        expect(getByTestId('vt-preset-input')).toBeTruthy();
    });
});
