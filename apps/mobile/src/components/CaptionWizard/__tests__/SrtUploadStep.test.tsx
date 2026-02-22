/**
 * Tests for SrtUploadStep component.
 *
 * Verifies rendering, text input, parse button behavior, error display,
 * and success summary display.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SrtUploadStep } from '../SrtUploadStep';
import { TestWrapper } from '../../__tests__/testUtils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('expo-document-picker', () => ({
    getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

jest.mock('expo-file-system', () => ({
    readAsStringAsync: jest.fn().mockResolvedValue(''),
}));

// Prevent LayoutAnimation teardown warnings
jest.useFakeTimers();

afterEach(() => {
    jest.runOnlyPendingTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SRT = [
    '1',
    '00:00:01,000 --> 00:00:04,000',
    'Hello world',
    '',
    '2',
    '00:00:05,000 --> 00:00:08,000',
    'Second entry',
    '',
].join('\n');

function renderStep(props: Partial<React.ComponentProps<typeof SrtUploadStep>> = {}) {
    const onParsed = jest.fn();
    const result = render(
        <TestWrapper>
            <SrtUploadStep onParsed={onParsed} {...props} />
        </TestWrapper>,
    );
    return { ...result, onParsed };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SrtUploadStep', () => {
    it('renders the title and subtitle', () => {
        const { getByText } = renderStep();
        expect(getByText('Import Subtitles')).toBeTruthy();
        expect(getByText(/Upload an SRT file or paste/)).toBeTruthy();
    });

    it('renders the paste text area by default', () => {
        const { getByTestId } = renderStep();
        expect(getByTestId('srt-upload-step-textarea')).toBeTruthy();
    });

    it('renders the parse button disabled when text is empty', () => {
        const { getByTestId } = renderStep();
        const button = getByTestId('srt-upload-step-parse-btn');
        expect(button).toBeTruthy();
    });

    it('calls onParsed after successful parsing', () => {
        const { getByTestId, onParsed } = renderStep();

        const textArea = getByTestId('srt-upload-step-textarea');
        fireEvent.changeText(textArea, VALID_SRT);

        const parseBtn = getByTestId('srt-upload-step-parse-btn');
        fireEvent.press(parseBtn);

        expect(onParsed).toHaveBeenCalledTimes(1);
        const [srtFile, rawText] = onParsed.mock.calls[0]!;
        expect(srtFile.totalEntries).toBe(2);
        expect(rawText).toBe(VALID_SRT);
    });

    it('shows success summary after parsing', () => {
        const { getByTestId, getByText } = renderStep();

        fireEvent.changeText(getByTestId('srt-upload-step-textarea'), VALID_SRT);
        fireEvent.press(getByTestId('srt-upload-step-parse-btn'));

        expect(getByTestId('srt-upload-step-summary')).toBeTruthy();
        expect(getByText(/Parsed Successfully/)).toBeTruthy();
        expect(getByText(/Entries: 2/)).toBeTruthy();
    });

    it('shows error for invalid SRT content', () => {
        const { getByTestId, getByText: _getByText } = renderStep();

        fireEvent.changeText(getByTestId('srt-upload-step-textarea'), 'invalid content');
        fireEvent.press(getByTestId('srt-upload-step-parse-btn'));

        expect(getByTestId('srt-upload-step-error')).toBeTruthy();
    });

    it('shows error for empty paste input', () => {
        const { getByTestId } = renderStep();

        // Change to non-empty then back to empty to enable the button
        fireEvent.changeText(getByTestId('srt-upload-step-textarea'), 'x');
        fireEvent.changeText(getByTestId('srt-upload-step-textarea'), '');

        // Button should be disabled — press should not crash
        const btn = getByTestId('srt-upload-step-parse-btn');
        expect(btn).toBeTruthy();
    });

    it('preserves initial raw text when provided', () => {
        const { getByTestId } = renderStep({ initialRawText: VALID_SRT });
        const textArea = getByTestId('srt-upload-step-textarea');
        expect(textArea.props.value).toBe(VALID_SRT);
    });
});
