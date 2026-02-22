/**
 * Tests for the CaptionWizard main component.
 *
 * Verifies initial step rendering, back button calling onDismiss,
 * and progress bar display.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CaptionWizard } from '../CaptionWizard';
import { TestWrapper } from '../../__tests__/testUtils';

// ---------------------------------------------------------------------------
// Mocks — needed by SrtUploadStep
// ---------------------------------------------------------------------------

jest.mock('expo-document-picker', () => ({
    getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

jest.mock('expo-file-system', () => ({
    readAsStringAsync: jest.fn().mockResolvedValue(''),
}));

// Prevent LayoutAnimation teardown errors — same pattern as CodeEditor tests
jest.useFakeTimers();

afterEach(() => {
    jest.runOnlyPendingTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWizard(
    props: Partial<React.ComponentProps<typeof CaptionWizard>> = {},
) {
    const onDismiss = jest.fn();
    const onProjectCreated = jest.fn();
    const result = render(
        <TestWrapper>
            <CaptionWizard
                onDismiss={onDismiss}
                onProjectCreated={onProjectCreated}
                {...props}
            />
        </TestWrapper>,
    );
    return { ...result, onDismiss, onProjectCreated };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CaptionWizard', () => {
    it('renders the wizard container', () => {
        const { getByTestId } = renderWizard();
        expect(getByTestId('caption-wizard')).toBeTruthy();
    });

    it('shows step 1 (Import Subtitles) initially', () => {
        const { getAllByText } = renderWizard();
        // Text appears in both Appbar header and SrtUploadStep body
        expect(getAllByText('Import Subtitles').length).toBeGreaterThanOrEqual(1);
    });

    it('shows the progress bar', () => {
        const { getByTestId } = renderWizard();
        expect(getByTestId('caption-wizard-progress')).toBeTruthy();
    });

    it('calls onDismiss when back is pressed on step 1', () => {
        const { getByTestId, onDismiss } = renderWizard();
        const backBtn = getByTestId('caption-wizard-back');
        fireEvent.press(backBtn);
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('shows the SRT upload step content', () => {
        const { getByTestId } = renderWizard();
        expect(getByTestId('caption-wizard-step-upload')).toBeTruthy();
    });

    it('renders with custom testID', () => {
        const { getByTestId } = renderWizard({ testID: 'my-wizard' });
        expect(getByTestId('my-wizard')).toBeTruthy();
    });
});
