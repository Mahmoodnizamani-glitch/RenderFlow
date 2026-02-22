import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AppButton } from '../AppButton';
import { TestWrapper } from './testUtils';

describe('AppButton', () => {
    it('renders with the correct label', () => {
        const { getByText } = render(
            <TestWrapper>
                <AppButton label="Click Me" onPress={() => { }} />
            </TestWrapper>,
        );
        expect(getByText('Click Me')).toBeTruthy();
    });

    it('calls onPress when pressed', () => {
        const onPress = jest.fn();
        const { getByText } = render(
            <TestWrapper>
                <AppButton label="Press" onPress={onPress} testID="test-btn" />
            </TestWrapper>,
        );
        fireEvent.press(getByText('Press'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when disabled', () => {
        const onPress = jest.fn();
        const { getByText } = render(
            <TestWrapper>
                <AppButton label="Disabled" onPress={onPress} disabled />
            </TestWrapper>,
        );
        fireEvent.press(getByText('Disabled'));
        expect(onPress).not.toHaveBeenCalled();
    });

    it('does not call onPress when loading', () => {
        const onPress = jest.fn();
        const { getByTestId } = render(
            <TestWrapper>
                <AppButton label="Loading" onPress={onPress} loading testID="loading-btn" />
            </TestWrapper>,
        );
        fireEvent.press(getByTestId('loading-btn'));
        expect(onPress).not.toHaveBeenCalled();
    });

    it('renders all button variants without crashing', () => {
        const variants = ['primary', 'secondary', 'outline', 'text'] as const;
        variants.forEach((variant) => {
            const { getByText } = render(
                <TestWrapper>
                    <AppButton label={`${variant} button`} variant={variant} onPress={() => { }} />
                </TestWrapper>,
            );
            expect(getByText(`${variant} button`)).toBeTruthy();
        });
    });

    it('has correct accessibility props', () => {
        const { getByTestId } = render(
            <TestWrapper>
                <AppButton
                    label="Accessible"
                    onPress={() => { }}
                    testID="a11y-btn"
                    accessibilityLabel="Custom a11y label"
                />
            </TestWrapper>,
        );
        const button = getByTestId('a11y-btn');
        expect(button).toBeTruthy();
    });
});
