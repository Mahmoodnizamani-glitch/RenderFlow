import React from 'react';
import { render } from '@testing-library/react-native';
import { LoadingOverlay } from '../LoadingOverlay';
import { TestWrapper } from './testUtils';

describe('LoadingOverlay', () => {
    it('renders when visible', () => {
        const { getByTestId } = render(
            <TestWrapper>
                <LoadingOverlay visible testID="loading" />
            </TestWrapper>,
        );
        expect(getByTestId('loading')).toBeTruthy();
    });

    it('does not render when not visible', () => {
        const { queryByTestId } = render(
            <TestWrapper>
                <LoadingOverlay visible={false} testID="loading" />
            </TestWrapper>,
        );
        expect(queryByTestId('loading')).toBeNull();
    });

    it('renders message when provided', () => {
        const { getByText } = render(
            <TestWrapper>
                <LoadingOverlay visible message="Rendering video..." />
            </TestWrapper>,
        );
        expect(getByText('Rendering video...')).toBeTruthy();
    });

    it('renders without message', () => {
        const { queryByText } = render(
            <TestWrapper>
                <LoadingOverlay visible />
            </TestWrapper>,
        );
        // No message text, just the spinner
        expect(queryByText('Rendering video...')).toBeNull();
    });
});
