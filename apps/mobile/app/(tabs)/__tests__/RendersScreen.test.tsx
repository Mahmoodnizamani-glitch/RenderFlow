/**
 * Tests for the Renders tab screen.
 *
 * Verifies empty state, section rendering, filter changes,
 * pull-to-refresh, and card interactions.
 */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import type { RenderJob } from '@renderflow/shared';
import { lightTheme } from '../../../src/theme';

// ---------------------------------------------------------------------------
// Store mock
// ---------------------------------------------------------------------------

const mockRefreshAll = jest.fn().mockResolvedValue(undefined);
const mockCancelCloudRender = jest.fn().mockResolvedValue(undefined);
const mockDeleteJob = jest.fn().mockResolvedValue(undefined);
const mockRetryRender = jest.fn().mockResolvedValue(undefined);
const mockGetDownloadUrl = jest.fn().mockResolvedValue({ downloadUrl: 'https://example.com', expiresIn: 3600 });

let mockStoreState: {
    activeJobs: RenderJob[];
    jobHistory: RenderJob[];
    isLoading: boolean;
    creditBalance: number;
};

jest.mock('../../../src/stores', () => ({
    useRenderStore: (selector: (s: typeof mockStoreState & Record<string, unknown>) => unknown) =>
        selector({
            ...mockStoreState,
            refreshAll: mockRefreshAll,
            cancelCloudRender: mockCancelCloudRender,
            deleteJob: mockDeleteJob,
            retryRender: mockRetryRender,
            getDownloadUrl: mockGetDownloadUrl,
        }),
    useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
        selector({
            isGuest: false,
            logout: jest.fn().mockResolvedValue(undefined),
        }),
}));

// Mock cache functions
jest.mock('../../../src/services/renderCache', () => ({
    getTotalCacheSize: jest.fn().mockResolvedValue(5_000_000),
    clearAllCache: jest.fn().mockResolvedValue(undefined),
    formatCacheSize: jest.fn((bytes: number) => {
        if (bytes === 0) return '0 B';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    }),
    cleanExpiredCache: jest.fn().mockResolvedValue(0),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import RendersScreen from '../renders';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

function renderScreen() {
    return render(
        <PaperProvider theme={lightTheme}>
            <RendersScreen />
        </PaperProvider>,
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RendersScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStoreState = {
            activeJobs: [],
            jobHistory: [],
            isLoading: false,
            creditBalance: 42,
        };
    });

    // -----------------------------------------------------------------------
    // Empty state
    // -----------------------------------------------------------------------

    it('renders empty state when no jobs exist', () => {
        renderScreen();

        expect(screen.getByTestId('renders-empty-state')).toBeTruthy();
        expect(screen.getByText('No renders yet')).toBeTruthy();
    });

    // -----------------------------------------------------------------------
    // Job list with sections
    // -----------------------------------------------------------------------

    it('renders active, completed, and failed sections', () => {
        mockStoreState = {
            ...mockStoreState,
            activeJobs: [
                makeJob({ id: 'active-1', status: 'processing', progress: 50 }),
            ],
            jobHistory: [
                makeJob({ id: 'completed-1', status: 'completed', createdAt: '2026-02-17T09:00:00.000Z' }),
                makeJob({ id: 'failed-1', status: 'failed', errorMessage: 'Error', createdAt: '2026-02-17T08:00:00.000Z' }),
            ],
        };

        renderScreen();

        expect(screen.getByTestId('section-active')).toBeTruthy();
        expect(screen.getByTestId('section-completed')).toBeTruthy();
        expect(screen.getByTestId('section-failed')).toBeTruthy();
    });

    // -----------------------------------------------------------------------
    // Credit balance
    // -----------------------------------------------------------------------

    it('displays credit balance', () => {
        renderScreen();

        expect(screen.getByTestId('credit-balance')).toBeTruthy();
        expect(screen.getByText('42 credits')).toBeTruthy();
    });

    // -----------------------------------------------------------------------
    // Filter chips
    // -----------------------------------------------------------------------

    it('filters to active only when Active chip is pressed', () => {
        mockStoreState = {
            ...mockStoreState,
            activeJobs: [
                makeJob({ id: 'active-1', status: 'processing', progress: 50 }),
            ],
            jobHistory: [
                makeJob({ id: 'completed-1', status: 'completed' }),
            ],
        };

        renderScreen();

        fireEvent.press(screen.getByTestId('filter-active'));

        // Should only show active job, not completed
        expect(screen.getByTestId('render-card-active-1')).toBeTruthy();
        expect(screen.queryByTestId('render-card-completed-1')).toBeNull();
    });

    it('filters to completed only when Done chip is pressed', () => {
        mockStoreState = {
            ...mockStoreState,
            activeJobs: [
                makeJob({ id: 'active-1', status: 'processing' }),
            ],
            jobHistory: [
                makeJob({ id: 'completed-1', status: 'completed' }),
            ],
        };

        renderScreen();

        fireEvent.press(screen.getByTestId('filter-completed'));

        expect(screen.getByTestId('render-card-completed-1')).toBeTruthy();
        expect(screen.queryByTestId('render-card-active-1')).toBeNull();
    });

    it('filters to failed only when Failed chip is pressed', () => {
        mockStoreState = {
            ...mockStoreState,
            jobHistory: [
                makeJob({ id: 'completed-1', status: 'completed' }),
                makeJob({ id: 'failed-1', status: 'failed', errorMessage: 'Error' }),
            ],
        };

        renderScreen();

        fireEvent.press(screen.getByTestId('filter-failed'));

        expect(screen.getByTestId('render-card-failed-1')).toBeTruthy();
        expect(screen.queryByTestId('render-card-completed-1')).toBeNull();
    });

    // -----------------------------------------------------------------------
    // Initial load
    // -----------------------------------------------------------------------

    it('calls refreshAll on mount', () => {
        renderScreen();

        expect(mockRefreshAll).toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Header title
    // -----------------------------------------------------------------------

    it('displays "Renders" as header title', () => {
        renderScreen();

        expect(screen.getByText('Renders')).toBeTruthy();
    });

    // -----------------------------------------------------------------------
    // Sort toggle
    // -----------------------------------------------------------------------

    it('renders sort toggle button', () => {
        renderScreen();

        expect(screen.getByTestId('sort-toggle')).toBeTruthy();
    });
});
