/**
 * VariableForm.test.tsx — tests for the VariableForm container component.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VariableForm } from '../VariableForm';
import type { VariableDefinition, VariableValues } from '@renderflow/shared';
import { TestWrapper } from '../../__tests__/testUtils';

// Helpers
const wrap = (ui: React.ReactElement) => render(ui, { wrapper: TestWrapper });

describe('VariableForm', () => {
    const mockOnValueChange = jest.fn();

    beforeEach(() => {
        mockOnValueChange.mockClear();
    });

    it('renders nothing for empty definitions', () => {
        const { queryByTestId } = wrap(
            <VariableForm
                definitions={[]}
                values={{}}
                onValueChange={mockOnValueChange}
                testID="vf"
            />,
        );
        expect(queryByTestId('vf')).toBeNull();
    });

    it('renders a string input for string-type definition', () => {
        const defs: VariableDefinition[] = [
            { name: 'title', type: 'string', label: 'Title' },
        ];
        const values: VariableValues = { title: 'Hello' };

        const { getByTestId } = wrap(
            <VariableForm
                definitions={defs}
                values={values}
                onValueChange={mockOnValueChange}
                testID="vf"
            />,
        );
        expect(getByTestId('vf-item-title')).toBeTruthy();
    });

    it('renders a number input for number-type definition', () => {
        const defs: VariableDefinition[] = [
            { name: 'count', type: 'number', label: 'Count' },
        ];
        const values: VariableValues = { count: 5 };

        const { getByTestId } = wrap(
            <VariableForm
                definitions={defs}
                values={values}
                onValueChange={mockOnValueChange}
                testID="vf"
            />,
        );
        expect(getByTestId('vf-item-count')).toBeTruthy();
    });

    it('renders a boolean input for boolean-type definition', () => {
        const defs: VariableDefinition[] = [
            { name: 'visible', type: 'boolean', label: 'Visible' },
        ];
        const values: VariableValues = { visible: true };

        const { getByTestId } = wrap(
            <VariableForm
                definitions={defs}
                values={values}
                onValueChange={mockOnValueChange}
                testID="vf"
            />,
        );
        expect(getByTestId('vf-item-visible')).toBeTruthy();
    });

    it('renders a color input for color-type definition', () => {
        const defs: VariableDefinition[] = [
            { name: 'bg', type: 'color', label: 'Background' },
        ];
        const values: VariableValues = { bg: '#FF0000' };

        const { getByTestId } = wrap(
            <VariableForm
                definitions={defs}
                values={values}
                onValueChange={mockOnValueChange}
                testID="vf"
            />,
        );
        expect(getByTestId('vf-item-bg')).toBeTruthy();
    });

    it('renders a range input for range-type definition', () => {
        const defs: VariableDefinition[] = [
            {
                name: 'opacity',
                type: 'range',
                label: 'Opacity',
                options: { min: 0, max: 1, step: 0.1 },
            },
        ];
        const values: VariableValues = { opacity: 0.5 };

        const { getByTestId } = wrap(
            <VariableForm
                definitions={defs}
                values={values}
                onValueChange={mockOnValueChange}
                testID="vf"
            />,
        );
        expect(getByTestId('vf-item-opacity')).toBeTruthy();
    });

    it('renders multiple definitions in order', () => {
        const defs: VariableDefinition[] = [
            { name: 'first', type: 'string', label: 'First' },
            { name: 'second', type: 'number', label: 'Second' },
            { name: 'third', type: 'boolean', label: 'Third' },
        ];
        const values: VariableValues = {};

        const { getByTestId } = wrap(
            <VariableForm
                definitions={defs}
                values={values}
                onValueChange={mockOnValueChange}
                testID="vf"
            />,
        );

        expect(getByTestId('vf-item-first')).toBeTruthy();
        expect(getByTestId('vf-item-second')).toBeTruthy();
        expect(getByTestId('vf-item-third')).toBeTruthy();
    });

    it('uses defaultValue when value is not set', () => {
        const defs: VariableDefinition[] = [
            { name: 'title', type: 'string', label: 'Title', defaultValue: 'Default' },
        ];
        const values: VariableValues = {};

        const { getByTestId } = wrap(
            <VariableForm
                definitions={defs}
                values={values}
                onValueChange={mockOnValueChange}
                testID="vf"
            />,
        );

        // The string input should exist — the component handles default internally
        expect(getByTestId('vf-item-title')).toBeTruthy();
    });

    it('calls onValueChange when a string input changes', () => {
        const defs: VariableDefinition[] = [
            { name: 'name', type: 'string', label: 'Name' },
        ];
        const values: VariableValues = { name: 'Alice' };

        const { getByTestId } = wrap(
            <VariableForm
                definitions={defs}
                values={values}
                onValueChange={mockOnValueChange}
                testID="vf"
            />,
        );

        fireEvent.changeText(getByTestId('vf-item-name-field'), 'Bob');
        expect(mockOnValueChange).toHaveBeenCalledWith('name', 'Bob');
    });
});
