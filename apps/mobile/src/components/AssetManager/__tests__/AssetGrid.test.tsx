/**
 * AssetGrid.test.tsx — tests for the asset thumbnail grid component.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { AssetGrid } from '../AssetGrid';
import type { Asset } from '@renderflow/shared';
import { darkTheme } from '../../../theme';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function wrap(ui: React.ReactElement) {
    return render(<PaperProvider theme={darkTheme}>{ui}</PaperProvider>);
}

const mockAssets: Asset[] = [
    {
        id: 'a1',
        projectId: 'p1',
        name: 'hero.png',
        type: 'image',
        mimeType: 'image/png',
        fileSize: 2048,
        localUri: 'file:///local/hero.png',
        remoteUrl: 'https://cdn.example.com/hero.png',
        createdAt: '2026-01-01T00:00:00Z',
    },
    {
        id: 'a2',
        projectId: 'p1',
        name: 'bgm.mp3',
        type: 'audio',
        mimeType: 'audio/mpeg',
        fileSize: 5120,
        localUri: null,
        remoteUrl: 'https://cdn.example.com/bgm.mp3',
        createdAt: '2026-01-02T00:00:00Z',
    },
    {
        id: 'a3',
        projectId: 'p1',
        name: 'Roboto.ttf',
        type: 'font',
        mimeType: 'font/ttf',
        fileSize: 1024,
        localUri: null,
        remoteUrl: null,
        createdAt: '2026-01-03T00:00:00Z',
    },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AssetGrid', () => {
    it('renders all asset cells', () => {
        const { getByTestId } = wrap(
            <AssetGrid assets={mockAssets} testID="ag" />,
        );

        expect(getByTestId('ag-cell-0')).toBeTruthy();
        expect(getByTestId('ag-cell-1')).toBeTruthy();
        expect(getByTestId('ag-cell-2')).toBeTruthy();
    });

    it('calls onAssetPress when a cell is pressed', () => {
        const onPress = jest.fn();
        const { getByTestId } = wrap(
            <AssetGrid assets={mockAssets} onAssetPress={onPress} testID="ag" />,
        );

        fireEvent.press(getByTestId('ag-cell-0'));
        expect(onPress).toHaveBeenCalledWith(mockAssets[0]);
    });

    it('renders image thumbnail for image assets', () => {
        const { getByTestId } = wrap(
            <AssetGrid assets={[mockAssets[0]!]} testID="ag" />,
        );

        expect(getByTestId('ag-cell-0-image')).toBeTruthy();
    });

    it('renders without crashing when empty', () => {
        const { getByTestId } = wrap(
            <AssetGrid assets={[]} testID="ag" />,
        );
        expect(getByTestId('ag')).toBeTruthy();
    });

    it('displays file sizes on cells', () => {
        const { getByText } = wrap(
            <AssetGrid assets={[mockAssets[0]!]} testID="ag" />,
        );

        // 2048 bytes = 2.0 KB
        expect(getByText('2.0 KB')).toBeTruthy();
    });
});
