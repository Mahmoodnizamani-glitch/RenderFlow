/**
 * Asset management store.
 *
 * Manages asset state for a project: loading, uploading (with progress),
 * filtering, sorting, and storage quota tracking.
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Asset, AssetType } from '@renderflow/shared';

import {
    fetchProjectAssets,
    uploadAsset as apiUploadAsset,
    deleteRemoteAsset,
    serverAssetToLocal,
} from '../api/assets';
import type { UploadProgressCallback } from '../api/assets';
import { AssetRepository } from '../db/repositories/AssetRepository';
import type { StorageUsage } from '../db/repositories/AssetRepository';
import {
    detectAssetType,
    validateBeforeUpload,
    STORAGE_QUOTAS,
} from '../utils/assetUploader';
import type { UserTier } from '../utils/assetUploader';
import { AppError } from '../errors/AppError';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AssetFilter = 'all' | AssetType;
export type AssetSortBy = 'name' | 'date' | 'size' | 'type';

export interface UploadTask {
    id: string;
    filename: string;
    progress: number;
    status: 'pending' | 'uploading' | 'done' | 'error';
    error?: string;
}

export interface AssetStore {
    // State
    projectId: string | null;
    assets: Asset[];
    isLoading: boolean;
    error: string | null;
    uploads: Record<string, UploadTask>;
    storageUsage: StorageUsage;
    filter: AssetFilter;
    sortBy: AssetSortBy;
    userTier: UserTier;

    // Actions
    setProject: (projectId: string) => void;
    loadAssets: (projectId: string) => Promise<void>;
    uploadAsset: (
        projectId: string,
        fileUri: string,
        filename: string,
        mimeType: string,
        fileSize: number,
    ) => Promise<void>;
    deleteAsset: (assetId: string) => Promise<void>;
    setFilter: (filter: AssetFilter) => void;
    setSortBy: (sortBy: AssetSortBy) => void;
    setUserTier: (tier: UserTier) => void;
    refreshStorageUsage: (projectId?: string) => Promise<void>;
    clearUploads: () => void;

    // Derived
    filteredAssets: () => Asset[];
    sortedAssets: () => Asset[];
    quotaPercent: () => number;
    quotaLimitBytes: () => number;
}

// ---------------------------------------------------------------------------
// Sort comparators
// ---------------------------------------------------------------------------

function sortAssets(assets: Asset[], sortBy: AssetSortBy): Asset[] {
    const sorted = [...assets];

    switch (sortBy) {
        case 'name':
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'date':
            sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            break;
        case 'size':
            sorted.sort((a, b) => b.fileSize - a.fileSize);
            break;
        case 'type':
            sorted.sort((a, b) => a.type.localeCompare(b.type));
            break;
    }

    return sorted;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAssetStore = create<AssetStore>()(
    immer((set, get) => ({
        // Initial state
        projectId: null,
        assets: [],
        isLoading: false,
        error: null,
        uploads: {},
        storageUsage: { totalBytes: 0, count: 0 },
        filter: 'all',
        sortBy: 'date',
        userTier: 'free',

        setProject: (projectId: string) => {
            set((state) => {
                state.projectId = projectId;
                state.assets = [];
                state.error = null;
                state.uploads = {};
            });
        },

        loadAssets: async (projectId: string) => {
            set((state) => {
                state.isLoading = true;
                state.error = null;
            });

            try {
                // Try remote first, fall back to local
                let assets: Asset[];
                try {
                    const serverAssets = await fetchProjectAssets(projectId);
                    assets = serverAssets.map(serverAssetToLocal);
                } catch {
                    // Offline fallback: load from local DB
                    assets = await AssetRepository.getByProject(projectId);
                }

                // Compute usage dynamically from loaded assets to support mock fallback
                const usage = {
                    totalBytes: assets.reduce((sum, a) => sum + a.fileSize, 0),
                    count: assets.length
                };

                set((state) => {
                    state.assets = assets;
                    state.storageUsage = usage;
                    state.isLoading = false;
                    state.projectId = projectId;
                });
            } catch (error: unknown) {
                const message = AppError.is(error)
                    ? error.message
                    : 'Failed to load assets';
                set((state) => {
                    state.isLoading = false;
                    state.error = message;
                });
            }
        },

        uploadAsset: async (
            projectId: string,
            fileUri: string,
            filename: string,
            mimeType: string,
            fileSize: number,
        ) => {
            const state = get();
            const quotaLimit = STORAGE_QUOTAS[state.userTier];

            // Pre-validate
            const validation = validateBeforeUpload(
                mimeType,
                fileSize,
                state.storageUsage.totalBytes,
                quotaLimit,
            );

            if (!validation.valid) {
                throw AppError.validation(
                    validation.error ?? 'File validation failed',
                );
            }

            const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const assetType = detectAssetType(mimeType) ?? 'image';

            // Register upload task
            set((state) => {
                state.uploads[uploadId] = {
                    id: uploadId,
                    filename,
                    progress: 0,
                    status: 'uploading',
                };
            });

            const onProgress: UploadProgressCallback = (progress) => {
                set((state) => {
                    const upload = state.uploads[uploadId];
                    if (upload) {
                        upload.progress = progress;
                    }
                });
            };

            try {
                // Upload via multipart with progress
                const serverAsset = await apiUploadAsset(
                    projectId,
                    fileUri,
                    filename,
                    mimeType,
                    onProgress,
                );

                // Save to local DB
                await AssetRepository.create({
                    projectId,
                    name: filename,
                    type: assetType,
                    mimeType,
                    fileSize,
                    localUri: fileUri,
                    remoteUrl: serverAsset.cdnUrl,
                });

                // Mark upload as done and refresh assets
                set((state) => {
                    const upload = state.uploads[uploadId];
                    if (upload) {
                        upload.progress = 100;
                        upload.status = 'done';
                    }
                });

                // Reload assets to get fresh list
                await get().loadAssets(projectId);
            } catch (error: unknown) {
                const message = error instanceof Error
                    ? error.message
                    : 'Upload failed';

                set((state) => {
                    const upload = state.uploads[uploadId];
                    if (upload) {
                        upload.status = 'error';
                        upload.error = message;
                    }
                });

                throw AppError.storage(message);
            }
        },

        deleteAsset: async (assetId: string) => {
            const state = get();
            const projectId = state.projectId;

            try {
                // Delete from remote
                await deleteRemoteAsset(assetId);
            } catch {
                // Remote delete may fail if offline — continue with local
            }

            try {
                // Delete from local DB
                await AssetRepository.delete(assetId);
            } catch {
                // Asset may not exist locally
            }

            // Remove from state
            set((s) => {
                s.assets = s.assets.filter((a) => a.id !== assetId);
            });

            // Refresh storage usage
            if (projectId) {
                await get().refreshStorageUsage(projectId);
            }
        },

        setFilter: (filter: AssetFilter) => {
            set((state) => {
                state.filter = filter;
            });
        },

        setSortBy: (sortBy: AssetSortBy) => {
            set((state) => {
                state.sortBy = sortBy;
            });
        },

        setUserTier: (tier: UserTier) => {
            set((state) => {
                state.userTier = tier;
            });
        },

        refreshStorageUsage: async (projectId?: string) => {
            try {
                const id = projectId ?? get().projectId;
                if (!id) return;
                const usage = await AssetRepository.getStorageUsage(id);
                set((state) => {
                    state.storageUsage = usage;
                });
            } catch {
                // Best effort
            }
        },

        clearUploads: () => {
            set((state) => {
                state.uploads = {};
            });
        },

        // Derived selectors
        filteredAssets: () => {
            const { assets, filter } = get();
            if (filter === 'all') return assets;
            return assets.filter((a) => a.type === filter);
        },

        sortedAssets: () => {
            const filtered = get().filteredAssets();
            return sortAssets(filtered, get().sortBy);
        },

        quotaPercent: () => {
            const { storageUsage, userTier } = get();
            const limit = STORAGE_QUOTAS[userTier];
            if (limit === 0) return 0;
            return Math.round((storageUsage.totalBytes / limit) * 100);
        },

        quotaLimitBytes: () => {
            return STORAGE_QUOTAS[get().userTier];
        },
    })),
);
