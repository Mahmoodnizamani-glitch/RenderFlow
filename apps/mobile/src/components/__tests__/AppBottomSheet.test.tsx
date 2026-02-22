import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native-paper';
import { AppBottomSheet } from '../AppBottomSheet';
import { TestWrapper } from './testUtils';

describe('AppBottomSheet', () => {
    it('renders content when visible', () => {
        const { getByText } = render(
            <TestWrapper>
                <AppBottomSheet visible onDismiss={() => { }} title="Sheet Title">
                    <Text>Sheet Content</Text>
                </AppBottomSheet>
            </TestWrapper>,
        );
        expect(getByText('Sheet Content')).toBeTruthy();
    });

    it('renders title when provided', () => {
        const { getByText } = render(
            <TestWrapper>
                <AppBottomSheet visible onDismiss={() => { }} title="My Sheet">
                    <Text>Content</Text>
                </AppBottomSheet>
            </TestWrapper>,
        );
        expect(getByText('My Sheet')).toBeTruthy();
    });

    it('does not render content when not visible', () => {
        const { queryByText } = render(
            <TestWrapper>
                <AppBottomSheet visible={false} onDismiss={() => { }}>
                    <Text>Hidden Content</Text>
                </AppBottomSheet>
            </TestWrapper>,
        );
        expect(queryByText('Hidden Content')).toBeNull();
    });

    it('renders close button when title is provided', () => {
        const { getByTestId } = render(
            <TestWrapper>
                <AppBottomSheet
                    visible
                    onDismiss={() => { }}
                    title="Closeable"
                    testID="sheet"
                >
                    <Text>Content</Text>
                </AppBottomSheet>
            </TestWrapper>,
        );
        expect(getByTestId('sheet-close')).toBeTruthy();
    });
});
