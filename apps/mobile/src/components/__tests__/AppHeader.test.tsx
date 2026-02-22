import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AppHeader } from '../AppHeader';
import { TestWrapper } from './testUtils';

describe('AppHeader', () => {
    it('renders title', () => {
        const { getByText } = render(
            <TestWrapper>
                <AppHeader title="My Screen" />
            </TestWrapper>,
        );
        expect(getByText('My Screen')).toBeTruthy();
    });

    it('renders back button when onBack is provided', () => {
        const onBack = jest.fn();
        const { getByTestId } = render(
            <TestWrapper>
                <AppHeader title="Details" onBack={onBack} testID="header" />
            </TestWrapper>,
        );
        const backButton = getByTestId('header-back');
        expect(backButton).toBeTruthy();
        fireEvent.press(backButton);
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('does not render back button when onBack is not provided', () => {
        const { queryByTestId } = render(
            <TestWrapper>
                <AppHeader title="Home" testID="header" />
            </TestWrapper>,
        );
        expect(queryByTestId('header-back')).toBeNull();
    });

    it('renders action buttons', () => {
        const onAction = jest.fn();
        const { getByTestId } = render(
            <TestWrapper>
                <AppHeader
                    title="Settings"
                    testID="header"
                    actions={[
                        { icon: 'cog', onPress: onAction, accessibilityLabel: 'Settings' },
                    ]}
                />
            </TestWrapper>,
        );
        const actionButton = getByTestId('header-action-0');
        expect(actionButton).toBeTruthy();
        fireEvent.press(actionButton);
        expect(onAction).toHaveBeenCalledTimes(1);
    });
});
