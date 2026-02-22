/**
 * Tests for StylePickerStep component.
 *
 * Verifies that all 4 style cards render and that selection callback fires.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StylePickerStep } from '../StylePickerStep';
import { TestWrapper } from '../../__tests__/testUtils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderStep(
    props: Partial<React.ComponentProps<typeof StylePickerStep>> = {},
) {
    const onStyleChange = jest.fn();
    const result = render(
        <TestWrapper>
            <StylePickerStep
                selectedStyle="hormozi"
                onStyleChange={onStyleChange}
                {...props}
            />
        </TestWrapper>,
    );
    return { ...result, onStyleChange };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StylePickerStep', () => {
    it('renders the title', () => {
        const { getByText } = renderStep();
        expect(getByText('Choose Caption Style')).toBeTruthy();
    });

    it('renders all 4 style cards', () => {
        const { getByTestId } = renderStep();
        expect(getByTestId('style-picker-step-card-hormozi')).toBeTruthy();
        expect(getByTestId('style-picker-step-card-minimal')).toBeTruthy();
        expect(getByTestId('style-picker-step-card-bounce')).toBeTruthy();
        expect(getByTestId('style-picker-step-card-karaoke')).toBeTruthy();
    });

    it('displays style names', () => {
        const { getByText } = renderStep();
        expect(getByText('Hormozi')).toBeTruthy();
        expect(getByText('Minimal')).toBeTruthy();
        expect(getByText('Bounce')).toBeTruthy();
        expect(getByText('Karaoke')).toBeTruthy();
    });

    it('calls onStyleChange when a card is pressed', () => {
        const { getByTestId, onStyleChange } = renderStep();

        fireEvent.press(getByTestId('style-picker-step-card-minimal'));
        expect(onStyleChange).toHaveBeenCalledWith('minimal');

        fireEvent.press(getByTestId('style-picker-step-card-bounce'));
        expect(onStyleChange).toHaveBeenCalledWith('bounce');
    });

    it('marks the selected card as accessible selected', () => {
        const { getByTestId } = renderStep({ selectedStyle: 'karaoke' });
        const card = getByTestId('style-picker-step-card-karaoke');
        expect(card.props.accessibilityState.selected).toBe(true);
    });

    it('marks non-selected cards as not selected', () => {
        const { getByTestId } = renderStep({ selectedStyle: 'hormozi' });
        const card = getByTestId('style-picker-step-card-minimal');
        expect(card.props.accessibilityState.selected).toBe(false);
    });
});
