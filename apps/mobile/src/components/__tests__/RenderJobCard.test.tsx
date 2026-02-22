/**
 * Tests for RenderJobCard component.
 *
 * Verifies correct rendering per status, button callbacks,
 * progress display, and ETA formatting.
 */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import type { RenderJob } from '@renderflow/shared';
import { RenderJobCard } from '../RenderJobCard';
import { lightTheme } from '../../theme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWithProviders(ui: React.ReactElement) {
    return render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);
}

function makeJob(overrides: Partial<RenderJob> = {}): RenderJob {
    return {
        id: 'job-1',
        projectId: 'proj-1',
        status: 'queued',
        renderType: 'cloud',
        format: 'mp4',
        quality: 80,
        resolution: '1920x1080',
        fps: 30,
        progress: 0,
        currentFrame: 0,
        totalFrames: 300,
        outputUri: null,
        remoteJobId: 'remote-1',
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: '2026-02-17T10:00:00.000Z',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RenderJobCard', () => {
    const onPress = jest.fn();
    const onCancel = jest.fn();
    const onRetry = jest.fn();
    const onDownload = jest.fn();
    const onShare = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // Queued state
    // -----------------------------------------------------------------------

    it('renders queued state with waiting text', () => {
        const job = makeJob({ status: 'queued' });

        renderWithProviders(
            <RenderJobCard
                job={job}
                onPress={onPress}
                onCancel={onCancel}
                testID="card"
            />,
        );

        expect(screen.getByTestId('card-status')).toBeTruthy();
        expect(screen.getByText('Queued')).toBeTruthy();
        expect(screen.getByText('Waiting in queue…')).toBeTruthy();
    });

    it('calls onCancel when cancel button pressed for queued job', () => {
        const job = makeJob({ status: 'queued' });

        renderWithProviders(
            <RenderJobCard
                job={job}
                onPress={onPress}
                onCancel={onCancel}
                testID="card"
            />,
        );

        fireEvent.press(screen.getByTestId('card-cancel'));
        expect(onCancel).toHaveBeenCalledWith(job);
    });

    // -----------------------------------------------------------------------
    // Processing state
    // -----------------------------------------------------------------------

    it('renders processing state with progress bar and frame count', () => {
        const job = makeJob({
            status: 'processing',
            progress: 45,
            currentFrame: 135,
            totalFrames: 300,
            startedAt: '2026-02-17T10:00:00.000Z',
        });

        renderWithProviders(
            <RenderJobCard
                job={job}
                onPress={onPress}
                onCancel={onCancel}
                testID="card"
            />,
        );

        expect(screen.getByTestId('card-progress')).toBeTruthy();
        expect(screen.getByText(/45%/)).toBeTruthy();
        expect(screen.getByText(/Frame 135\/300/)).toBeTruthy();
        expect(screen.getByText('Rendering')).toBeTruthy();
    });

    // -----------------------------------------------------------------------
    // Completed state
    // -----------------------------------------------------------------------

    it('renders completed state with download and share buttons', () => {
        const job = makeJob({
            status: 'completed',
            progress: 100,
            currentFrame: 300,
            startedAt: '2026-02-17T10:00:00.000Z',
            completedAt: '2026-02-17T10:05:00.000Z',
            outputUri: 'https://cdn.example.com/video.mp4',
        });

        renderWithProviders(
            <RenderJobCard
                job={job}
                onPress={onPress}
                onDownload={onDownload}
                onShare={onShare}
                testID="card"
            />,
        );

        expect(screen.getByText('Completed')).toBeTruthy();
        expect(screen.getByTestId('card-download')).toBeTruthy();
        expect(screen.getByTestId('card-share')).toBeTruthy();
    });

    it('calls onDownload when download button pressed', () => {
        const job = makeJob({
            status: 'completed',
            outputUri: 'https://cdn.example.com/video.mp4',
        });

        renderWithProviders(
            <RenderJobCard
                job={job}
                onPress={onPress}
                onDownload={onDownload}
                testID="card"
            />,
        );

        fireEvent.press(screen.getByTestId('card-download'));
        expect(onDownload).toHaveBeenCalledWith(job);
    });

    // -----------------------------------------------------------------------
    // Failed state
    // -----------------------------------------------------------------------

    it('renders failed state with error message and retry button', () => {
        const job = makeJob({
            status: 'failed',
            errorMessage: 'Out of memory during rendering',
        });

        renderWithProviders(
            <RenderJobCard
                job={job}
                onPress={onPress}
                onRetry={onRetry}
                testID="card"
            />,
        );

        expect(screen.getByText('Failed')).toBeTruthy();
        expect(screen.getByText('Out of memory during rendering')).toBeTruthy();
        expect(screen.getByTestId('card-retry')).toBeTruthy();
    });

    it('calls onRetry when retry button pressed', () => {
        const job = makeJob({ status: 'failed', errorMessage: 'Error' });

        renderWithProviders(
            <RenderJobCard
                job={job}
                onPress={onPress}
                onRetry={onRetry}
                testID="card"
            />,
        );

        fireEvent.press(screen.getByTestId('card-retry'));
        expect(onRetry).toHaveBeenCalledWith(job);
    });

    // -----------------------------------------------------------------------
    // Card press
    // -----------------------------------------------------------------------

    it('calls onPress when card is tapped', () => {
        const job = makeJob();

        renderWithProviders(
            <RenderJobCard
                job={job}
                onPress={onPress}
                testID="card"
            />,
        );

        fireEvent.press(screen.getAllByTestId('card')[0]);
        expect(onPress).toHaveBeenCalledWith(job);
    });

    // -----------------------------------------------------------------------
    // Badge display
    // -----------------------------------------------------------------------

    it('displays format, resolution, and fps badges', () => {
        const job = makeJob({
            format: 'webm',
            resolution: '3840x2160',
            fps: 60,
        });

        renderWithProviders(
            <RenderJobCard
                job={job}
                onPress={onPress}
                testID="card"
            />,
        );

        expect(screen.getByText('WEBM • 3840x2160 • 60fps')).toBeTruthy();
    });
});
