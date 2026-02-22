/**
 * Assets tab — main container.
 *
 * Orchestrates the full asset management flow:
 * toolbar → grid → preview → upload → storage quota.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import type { Asset } from '@renderflow/shared';
import { useAppTheme } from '../../theme';
import { EmptyState } from '../EmptyState';
import { ConfirmDialog } from '../ConfirmDialog';
import { AssetToolbar } from './AssetToolbar';
import { AssetGrid } from './AssetGrid';
import { UploadProgress } from './UploadProgress';
import { StorageQuota } from './StorageQuota';
import { AssetPreviewSheet } from './AssetPreviewSheet';
import { useAssetStore } from '../../stores/useAssetStore';
import { pickImage, pickFile } from '../../utils/assetUploader';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AssetsTabProps {
    projectId: string;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssetsTab({ projectId, testID }: AssetsTabProps) {
    const theme = useAppTheme();

    // Store
    const isLoading = useAssetStore((s) => s.isLoading);
    const filter = useAssetStore((s) => s.filter);
    const sortBy = useAssetStore((s) => s.sortBy);
    const uploads = useAssetStore((s) => s.uploads);
    const storageUsage = useAssetStore((s) => s.storageUsage);
    const loadAssets = useAssetStore((s) => s.loadAssets);
    const uploadAsset = useAssetStore((s) => s.uploadAsset);
    const deleteAssetAction = useAssetStore((s) => s.deleteAsset);
    const setFilter = useAssetStore((s) => s.setFilter);
    const setSortBy = useAssetStore((s) => s.setSortBy);
    const clearUploads = useAssetStore((s) => s.clearUploads);
    const quotaLimitBytes = useAssetStore((s) => s.quotaLimitBytes);
    const sortedAssets = useAssetStore((s) => s.sortedAssets);

    // Local state
    const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
    const [snackMessage, setSnackMessage] = useState<string | null>(null);

    // Derived
    const assets = sortedAssets();
    const quota = quotaLimitBytes();

    // Load assets on mount
    useEffect(() => {
        void loadAssets(projectId);
    }, [projectId, loadAssets]);

    // -----------------------------------------------------------------
    // Upload flow
    // -----------------------------------------------------------------

    const handleUploadPress = useCallback(() => {
        Alert.alert('Upload Asset', 'Choose source:', [
            {
                text: 'Photo Library',
                onPress: async () => {
                    const picked = await pickImage('library');
                    if (picked) {
                        try {
                            await uploadAsset(projectId, picked.uri, picked.name, picked.mimeType, picked.size);
                            setSnackMessage('Asset uploaded successfully');
                        } catch (error: unknown) {
                            const message = error instanceof Error ? error.message : 'Upload failed';
                            setSnackMessage(message);
                        }
                    }
                },
            },
            {
                text: 'Camera',
                onPress: async () => {
                    const picked = await pickImage('camera');
                    if (picked) {
                        try {
                            await uploadAsset(projectId, picked.uri, picked.name, picked.mimeType, picked.size);
                            setSnackMessage('Asset uploaded successfully');
                        } catch (error: unknown) {
                            const message = error instanceof Error ? error.message : 'Upload failed';
                            setSnackMessage(message);
                        }
                    }
                },
            },
            {
                text: 'File',
                onPress: async () => {
                    const picked = await pickFile();
                    if (picked) {
                        try {
                            await uploadAsset(projectId, picked.uri, picked.name, picked.mimeType, picked.size);
                            setSnackMessage('Asset uploaded successfully');
                        } catch (error: unknown) {
                            const message = error instanceof Error ? error.message : 'Upload failed';
                            setSnackMessage(message);
                        }
                    }
                },
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    }, [projectId, uploadAsset]);

    // -----------------------------------------------------------------
    // Copy URL
    // -----------------------------------------------------------------

    const handleCopyUrl = useCallback(async (asset: Asset) => {
        const url = asset.remoteUrl ?? asset.localUri ?? '';
        if (url) {
            await Clipboard.setStringAsync(url);
            setSnackMessage("Asset URL copied. Use it in your code like: staticFile('url')");
        } else {
            setSnackMessage('No URL available for this asset');
        }
        setPreviewAsset(null);
    }, []);

    // -----------------------------------------------------------------
    // Delete
    // -----------------------------------------------------------------

    const handleDeleteConfirm = useCallback(async () => {
        if (!deleteTarget) return;
        try {
            await deleteAssetAction(deleteTarget.id);
            setSnackMessage('Asset deleted');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Delete failed';
            setSnackMessage(message);
        }
        setDeleteTarget(null);
        setPreviewAsset(null);
    }, [deleteTarget, deleteAssetAction]);

    // -----------------------------------------------------------------
    // Refresh
    // -----------------------------------------------------------------

    const handleRefresh = useCallback(() => {
        void loadAssets(projectId);
    }, [projectId, loadAssets]);

    // -----------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]} testID={testID}>
            {/* Toolbar */}
            <AssetToolbar
                filter={filter}
                sortBy={sortBy}
                onFilterChange={setFilter}
                onSortChange={setSortBy}
                onUploadPress={handleUploadPress}
                testID={testID ? `${testID}-toolbar` : undefined}
            />

            {/* Upload progress */}
            <UploadProgress
                uploads={uploads}
                onClear={clearUploads}
                testID={testID ? `${testID}-uploads` : undefined}
            />

            {/* Content */}
            {assets.length === 0 && !isLoading ? (
                <EmptyState
                    icon="folder-open"
                    title="No assets yet"
                    subtitle="Upload images, videos, audio, or fonts to use in your compositions."
                    actionLabel="Upload Asset"
                    onAction={handleUploadPress}
                    testID={testID ? `${testID}-empty` : undefined}
                />
            ) : (
                <AssetGrid
                    assets={assets}
                    onAssetPress={(a) => setPreviewAsset(a)}
                    onCopyUrl={handleCopyUrl}
                    onDelete={(a) => setDeleteTarget(a)}
                    onPreview={(a) => setPreviewAsset(a)}
                    isLoading={isLoading}
                    onRefresh={handleRefresh}
                    testID={testID ? `${testID}-grid` : undefined}
                />
            )}

            {/* Storage quota */}
            <StorageQuota
                usedBytes={storageUsage.totalBytes}
                totalBytes={quota}
                assetCount={storageUsage.count}
                testID={testID ? `${testID}-quota` : undefined}
            />

            {/* Preview sheet */}
            {previewAsset && (
                <AssetPreviewSheet
                    asset={previewAsset}
                    visible={!!previewAsset}
                    onDismiss={() => setPreviewAsset(null)}
                    onCopyUrl={handleCopyUrl}
                    onDelete={(a) => {
                        setPreviewAsset(null);
                        setDeleteTarget(a);
                    }}
                    testID={testID ? `${testID}-preview` : undefined}
                />
            )}

            {/* Delete confirmation */}
            <ConfirmDialog
                visible={!!deleteTarget}
                title="Delete Asset"
                message={`Are you sure you want to delete "${deleteTarget?.name ?? ''}"? This will also remove it from cloud storage.`}
                confirmLabel="Delete"
                onConfirm={() => void handleDeleteConfirm()}
                onCancel={() => setDeleteTarget(null)}
                destructive
                testID={testID ? `${testID}-delete-dialog` : undefined}
            />

            {/* Snackbar */}
            <Snackbar
                visible={!!snackMessage}
                onDismiss={() => setSnackMessage(null)}
                duration={3000}
                testID={testID ? `${testID}-snackbar` : undefined}
            >
                {snackMessage ?? ''}
            </Snackbar>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
