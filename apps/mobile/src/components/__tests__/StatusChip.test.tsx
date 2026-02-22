import React from 'react';
import { render } from '@testing-library/react-native';
import { StatusChip } from '../StatusChip';
import { TestWrapper } from './testUtils';
import type { RenderStatus } from '../StatusChip';

describe('StatusChip', () => {
    const statuses: RenderStatus[] = ['queued', 'rendering', 'done', 'failed'];

    it.each(statuses)('renders %s status correctly', (status) => {
        const { getByTestId } = render(
            <TestWrapper>
                <StatusChip status={status} testID={`chip-${status}`} />
            </TestWrapper>,
        );
        expect(getByTestId(`chip-${status}`)).toBeTruthy();
    });

    it('displays Queued label for queued status', () => {
        const { getByText } = render(
            <TestWrapper>
                <StatusChip status="queued" />
            </TestWrapper>,
        );
        expect(getByText('Queued')).toBeTruthy();
    });

    it('displays Rendering label for rendering status', () => {
        const { getByText } = render(
            <TestWrapper>
                <StatusChip status="rendering" />
            </TestWrapper>,
        );
        expect(getByText('Rendering')).toBeTruthy();
    });

    it('displays Done label for done status', () => {
        const { getByText } = render(
            <TestWrapper>
                <StatusChip status="done" />
            </TestWrapper>,
        );
        expect(getByText('Done')).toBeTruthy();
    });

    it('displays Failed label for failed status', () => {
        const { getByText } = render(
            <TestWrapper>
                <StatusChip status="failed" />
            </TestWrapper>,
        );
        expect(getByText('Failed')).toBeTruthy();
    });
});
