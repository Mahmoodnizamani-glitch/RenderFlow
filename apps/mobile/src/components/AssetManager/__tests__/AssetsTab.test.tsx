/**
 * AssetsTab.test.tsx — tests for the assets tab container component.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { AssetsTab } from '../AssetsTab';
import { useAssetStore } from '../../../stores/useAssetStore';
import { darkTheme } from '../../../theme';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function wrap(ui: React.ReactElement) {
    return render(<PaperProvider theme={darkTheme}>{ui}</PaperProvider>);
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../../stores/useAssetStore');

const mockLoadAssets = jest.fn();
const mockUploadAsset = jest.fn();
const mockDeleteAsset = jest.fn();
const mockSetFilter = jest.fn();
const mockSetSortBy = jest.fn();
const mockClearUploads = jest.fn();

function setupStoreMock(overrides: Record<string, unknown> = {}) {
    const defaultState = {
        isLoading: false,
        filter: 'all' as const,
        sortBy: 'date' as const,
        uploads: {},
        storageUsage: { totalBytes: 0, count: 0 },
        assets: [],
        error: null,
        projectId: 'proj-1',
        userTier: 'free' as const,
        loadAssets: mockLoadAssets,
        uploadAsset: mockUploadAsset,
        deleteAsset: mockDeleteAsset,
        setFilter: mockSetFilter,
        setSortBy: mockSetSortBy,
        clearUploads: mockClearUploads,
        quotaLimitBytes: () => 500 * 1024 * 1024,
        sortedAssets: () => [],
        filteredAssets: () => [],
        quotaPercent: () => 0,
        ...overrides,
    };

    (useAssetStore as unknown as jest.Mock).mockImplementation(
        (selector: (s: typeof defaultState) => unknown) => selector(defaultState),
    );
}

beforeEach(() => {
    jest.clearAllMocks();
    setupStoreMock();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AssetsTab', () => {
    it('renders empty state when no assets', () => {
        const { getByTestId } = wrap(<AssetsTab projectId="proj-1" testID="at" />);
        expect(getByTestId('at-empty')).toBeTruthy();
    });

    it('calls loadAssets on mount', () => {
        wrap(<AssetsTab projectId="proj-1" testID="at" />);
        expect(mockLoadAssets).toHaveBeenCalledWith('proj-1');
    });

    it('renders toolbar', () => {
        const { getByTestId } = wrap(<AssetsTab projectId="proj-1" testID="at" />);
        expect(getByTestId('at-toolbar')).toBeTruthy();
    });

    it('renders storage quota', () => {
        const { getByTestId } = wrap(<AssetsTab projectId="proj-1" testID="at" />);
        expect(getByTestId('at-quota')).toBeTruthy();
    });

    it('renders asset grid when assets exist', () => {
        const mockAssets = [
            {
                id: 'a1',
                projectId: 'proj-1',
                name: 'photo.jpg',
                type: 'image',
                mimeType: 'image/jpeg',
                fileSize: 1024,
                localUri: null,
                remoteUrl: 'https://cdn.example.com/photo.jpg',
                createdAt: '2026-01-01T00:00:00Z',
            },
        ];

        setupStoreMock({
            sortedAssets: () => mockAssets,
        });

        const { getByTestId } = wrap(<AssetsTab projectId="proj-1" testID="at" />);
        expect(getByTestId('at-grid')).toBeTruthy();
    });

    it('renders upload progress when uploads exist', () => {
        setupStoreMock({
            uploads: {
                'upload-1': {
                    id: 'upload-1',
                    filename: 'test.png',
                    progress: 50,
                    status: 'uploading',
                },
            },
        });

        const { getByTestId } = wrap(<AssetsTab projectId="proj-1" testID="at" />);
        expect(getByTestId('at-uploads')).toBeTruthy();
    });
});
