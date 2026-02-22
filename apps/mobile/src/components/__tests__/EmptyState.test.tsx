import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EmptyState } from '../EmptyState';
import { TestWrapper } from './testUtils';

describe('EmptyState', () => {
    it('renders title and subtitle', () => {
        const { getByText } = render(
            <TestWrapper>
                <EmptyState
                    icon="video-off-outline"
                    title="No Videos"
                    subtitle="Create your first video"
                />
            </TestWrapper>,
        );
        expect(getByText('No Videos')).toBeTruthy();
        expect(getByText('Create your first video')).toBeTruthy();
    });

    it('renders without subtitle', () => {
        const { getByText, queryByText } = render(
            <TestWrapper>
                <EmptyState icon="inbox-outline" title="Nothing Here" />
            </TestWrapper>,
        );
        expect(getByText('Nothing Here')).toBeTruthy();
        expect(queryByText('Create your first video')).toBeNull();
    });

    it('renders action button and handles press', () => {
        const onAction = jest.fn();
        const { getByText } = render(
            <TestWrapper>
                <EmptyState
                    icon="plus"
                    title="Empty"
                    actionLabel="Add Item"
                    onAction={onAction}
                />
            </TestWrapper>,
        );
        const button = getByText('Add Item');
        expect(button).toBeTruthy();
        fireEvent.press(button);
        expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('does not render action button without actionLabel', () => {
        const { queryByText } = render(
            <TestWrapper>
                <EmptyState icon="info" title="Info" />
            </TestWrapper>,
        );
        expect(queryByText('Add Item')).toBeNull();
    });
});
