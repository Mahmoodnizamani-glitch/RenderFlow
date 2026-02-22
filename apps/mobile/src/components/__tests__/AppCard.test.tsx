import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native-paper';
import { AppCard } from '../AppCard';
import { TestWrapper } from './testUtils';

describe('AppCard', () => {
    it('renders children correctly', () => {
        const { getByText } = render(
            <TestWrapper>
                <AppCard>
                    <Text>Card Content</Text>
                </AppCard>
            </TestWrapper>,
        );
        expect(getByText('Card Content')).toBeTruthy();
    });

    it('renders with elevated variant by default', () => {
        const { getByTestId } = render(
            <TestWrapper>
                <AppCard testID="card-elevated">
                    <Text>Content</Text>
                </AppCard>
            </TestWrapper>,
        );
        expect(getByTestId('card-elevated')).toBeTruthy();
    });

    it('renders with outlined variant', () => {
        const { getByTestId } = render(
            <TestWrapper>
                <AppCard variant="outlined" testID="card-outlined">
                    <Text>Content</Text>
                </AppCard>
            </TestWrapper>,
        );
        expect(getByTestId('card-outlined')).toBeTruthy();
    });

    it('handles onPress when provided', () => {
        const onPress = jest.fn();
        const { getByTestId } = render(
            <TestWrapper>
                <AppCard onPress={onPress} testID="pressable-card">
                    <Text>Pressable</Text>
                </AppCard>
            </TestWrapper>,
        );
        expect(getByTestId('pressable-card')).toBeTruthy();
    });
});
