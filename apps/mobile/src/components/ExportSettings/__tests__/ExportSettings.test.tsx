/**
 * ExportSettings component tests.
 *
 * Verifies rendering, option selection, GIF constraints,
 * validation, and render confirmation flow.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../theme';
import { ExportSettings } from '../ExportSettingsView';

// Mock useRenderStore
jest.mock('../../../stores', () => ({
    useRenderStore: jest.fn((selector) => {
        const store = {
            createJob: jest.fn().mockResolvedValue({
                id: 'test-job-id',
                projectId: 'test-project',
                status: 'queued',
            }),
        };
        return selector(store);
    }),
}));

function renderWithTheme(ui: React.ReactElement) {
    return render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);
}

const defaultProps = {
    projectId: 'test-project-id',
    projectName: 'Test Project',
    code: 'const MyComposition = () => null;',
    compositionWidth: 1920,
    compositionHeight: 1080,
    fps: 30,
    durationInFrames: 150,
    onRenderQueued: jest.fn(),
};

describe('ExportSettings', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the main container', () => {
        const { getByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );
        expect(getByTestId('export')).toBeTruthy();
    });

    it('renders format selector with three options', () => {
        const { getByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );
        expect(getByTestId('export-format-mp4')).toBeTruthy();
        expect(getByTestId('export-format-webm')).toBeTruthy();
        expect(getByTestId('export-format-gif')).toBeTruthy();
    });

    it('renders quality presets', () => {
        const { getByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );
        expect(getByTestId('export-quality-draft')).toBeTruthy();
        expect(getByTestId('export-quality-standard')).toBeTruthy();
        expect(getByTestId('export-quality-high')).toBeTruthy();
        expect(getByTestId('export-quality-maximum')).toBeTruthy();
    });

    it('renders resolution options for mp4', () => {
        const { getByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );
        expect(getByTestId('export-resolution-720p')).toBeTruthy();
        expect(getByTestId('export-resolution-1080p')).toBeTruthy();
        expect(getByTestId('export-resolution-1440p')).toBeTruthy();
        expect(getByTestId('export-resolution-4k')).toBeTruthy();
    });

    it('renders fps options for mp4', () => {
        const { getByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );
        expect(getByTestId('export-fps-24')).toBeTruthy();
        expect(getByTestId('export-fps-30')).toBeTruthy();
        expect(getByTestId('export-fps-60')).toBeTruthy();
    });

    it('displays codec info', () => {
        const { getByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );
        const codec = getByTestId('export-codec');
        expect(codec.props.children).toEqual(['Codec: ', 'H.264']);
    });

    it('displays credit cost estimate', () => {
        const { getByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );
        const credits = getByTestId('export-credits');
        // 150 frames / 30 fps = 5 seconds = 0.083 min ≈ 0.08 credits
        expect(credits).toBeTruthy();
    });

    it('displays duration information', () => {
        const { getByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );
        const duration = getByTestId('export-duration');
        expect(duration.props.children).toEqual(['5.0', 's (', 150, ' frames)']);
    });

    it('displays estimated file size', () => {
        const { getByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );
        expect(getByTestId('export-filesize')).toBeTruthy();
    });

    it('displays remaining credits placeholder', () => {
        const { getByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );
        expect(getByTestId('export-remaining')).toBeTruthy();
    });

    it('renders output filename input', () => {
        const { getByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );
        expect(getByTestId('export-filename')).toBeTruthy();
    });

    it('renders render method options', () => {
        const { getByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );
        expect(getByTestId('export-method-cloud')).toBeTruthy();
        expect(getByTestId('export-method-local')).toBeTruthy();
    });

    it('renders the start render button', () => {
        const { getByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );
        expect(getByTestId('export-start-render')).toBeTruthy();
    });

    it('hides fps selector when gif is selected', () => {
        const { getByTestId, queryByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );

        // Select GIF
        fireEvent.press(getByTestId('export-format-gif'));

        // FPS options should be gone
        expect(queryByTestId('export-fps-24')).toBeNull();
        expect(queryByTestId('export-fps-30')).toBeNull();
        expect(queryByTestId('export-fps-60')).toBeNull();
    });

    it('caps resolution to 1080p for gif', () => {
        const { getByTestId, queryByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );

        // Select GIF
        fireEvent.press(getByTestId('export-format-gif'));

        // 720p and 1080p should be visible
        expect(getByTestId('export-resolution-720p')).toBeTruthy();
        expect(getByTestId('export-resolution-1080p')).toBeTruthy();

        // 1440p and 4K should be hidden
        expect(queryByTestId('export-resolution-1440p')).toBeNull();
        expect(queryByTestId('export-resolution-4k')).toBeNull();
    });

    it('shows validation error when code is empty', () => {
        const { getByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} code="" testID="export" />,
        );
        expect(getByTestId('export-validation-error')).toBeTruthy();
    });

    it('disables start render button when code is empty', () => {
        const { getByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} code="" testID="export" />,
        );
        const button = getByTestId('export-start-render');
        expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it('does not show validation error when code exists', () => {
        const { queryByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );
        expect(queryByTestId('export-validation-error')).toBeNull();
    });

    it('opens confirmation sheet when start render is pressed', () => {
        const { getByTestId, queryByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );

        fireEvent.press(getByTestId('export-start-render'));
        // The confirmation sheet should now be visible
        expect(queryByTestId('export-confirm-sheet')).toBeTruthy();
    });

    it('changes codec display when format changes', () => {
        const { getByTestId } = renderWithTheme(
            <ExportSettings {...defaultProps} testID="export" />,
        );

        // Select WebM
        fireEvent.press(getByTestId('export-format-webm'));

        const codec = getByTestId('export-codec');
        expect(codec.props.children).toEqual(['Codec: ', 'VP9']);
    });
});
