/**
 * Asset upload utilities.
 *
 * File picking, validation, and size-limit enforcement for asset uploads.
 * Validates file size and type before initiating upload.
 */
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import type { AssetType } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max file sizes in bytes per asset type. */
export const MAX_FILE_SIZES: Record<AssetType, number> = {
    image: 20 * 1024 * 1024,   // 20 MB
    video: 100 * 1024 * 1024,  // 100 MB
    audio: 50 * 1024 * 1024,   // 50 MB
    font: 5 * 1024 * 1024,     // 5 MB
} as const;

/** Storage quota limits in bytes per user tier. */
export const STORAGE_QUOTAS = {
    free: 500 * 1024 * 1024,    // 500 MB
    pro: 5 * 1024 * 1024 * 1024, // 5 GB
    team: 20 * 1024 * 1024 * 1024, // 20 GB
} as const;

export type UserTier = keyof typeof STORAGE_QUOTAS;

/** Allowed MIME types by asset type. */
const ALLOWED_MIME_TYPES: Record<AssetType, string[]> = {
    image: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    ],
    video: [
        'video/mp4', 'video/webm', 'video/quicktime',
    ],
    audio: [
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-wav',
    ],
    font: [
        'font/ttf', 'font/otf', 'font/woff', 'font/woff2',
        'application/x-font-ttf', 'application/x-font-otf',
        'application/font-woff', 'application/font-woff2',
    ],
};

/** All allowed MIME types (flattened). */
const ALL_ALLOWED_MIME_TYPES = Object.values(ALLOWED_MIME_TYPES).flat();

// ---------------------------------------------------------------------------
// Pick result type
// ---------------------------------------------------------------------------

export interface PickedFile {
    uri: string;
    name: string;
    mimeType: string;
    size: number;
    assetType: AssetType;
}

// ---------------------------------------------------------------------------
// Type detection
// ---------------------------------------------------------------------------

/**
 * Detect the asset type from a MIME type string.
 * Returns null if the MIME type is not supported.
 */
export function detectAssetType(mimeType: string): AssetType | null {
    const lower = mimeType.toLowerCase();

    for (const [type, mimes] of Object.entries(ALLOWED_MIME_TYPES)) {
        if (mimes.some((m) => lower.startsWith(m) || lower === m)) {
            return type as AssetType;
        }
    }

    // Fallback heuristics
    if (lower.startsWith('image/')) return 'image';
    if (lower.startsWith('video/')) return 'video';
    if (lower.startsWith('audio/')) return 'audio';
    if (lower.includes('font') || lower.includes('ttf') || lower.includes('otf')) return 'font';

    return null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validate a file before upload.
 * Checks: supported type, file size limit, storage quota.
 */
export function validateBeforeUpload(
    mimeType: string,
    fileSize: number,
    currentUsageBytes: number,
    quotaLimitBytes: number,
): ValidationResult {
    const assetType = detectAssetType(mimeType);

    if (!assetType) {
        return {
            valid: false,
            error: `Unsupported file type: ${mimeType}. Allowed: images, videos, audio, and fonts.`,
        };
    }

    const maxSize = MAX_FILE_SIZES[assetType];
    if (fileSize > maxSize) {
        const maxMB = Math.round(maxSize / (1024 * 1024));
        const fileMB = (fileSize / (1024 * 1024)).toFixed(1);
        return {
            valid: false,
            error: `File size (${fileMB} MB) exceeds the ${maxMB} MB limit for ${assetType}s.`,
        };
    }

    if (currentUsageBytes + fileSize > quotaLimitBytes) {
        const usedMB = Math.round(currentUsageBytes / (1024 * 1024));
        const quotaMB = Math.round(quotaLimitBytes / (1024 * 1024));
        return {
            valid: false,
            error: `Upload would exceed your storage quota (${usedMB} MB / ${quotaMB} MB). Please delete some assets or upgrade your plan.`,
        };
    }

    return { valid: true };
}

// ---------------------------------------------------------------------------
// File pickers
// ---------------------------------------------------------------------------

/**
 * Pick an image from camera or library via expo-image-picker.
 * Returns null if the user cancelled.
 */
export async function pickImage(
    source: 'camera' | 'library' = 'library',
): Promise<PickedFile | null> {
    const launchFn = source === 'camera'
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;

    const result = await launchFn({
        mediaTypes: ['images', 'videos'],
        quality: 1,
        allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) {
        return null;
    }

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? asset.type ?? 'image/jpeg';
    const assetType = detectAssetType(mimeType) ?? 'image';
    const name = asset.fileName ?? `asset_${Date.now()}.${mimeType.split('/')[1] ?? 'jpg'}`;

    return {
        uri: asset.uri,
        name,
        mimeType,
        size: asset.fileSize ?? 0,
        assetType,
    };
}

/**
 * Pick a file via expo-document-picker.
 * Supports all allowed asset types.
 * Returns null if the user cancelled.
 */
export async function pickFile(): Promise<PickedFile | null> {
    const result = await DocumentPicker.getDocumentAsync({
        type: ALL_ALLOWED_MIME_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) {
        return null;
    }

    const doc = result.assets[0];
    const mimeType = doc.mimeType ?? 'application/octet-stream';
    const assetType = detectAssetType(mimeType);

    if (!assetType) {
        return null;
    }

    return {
        uri: doc.uri,
        name: doc.name,
        mimeType,
        size: doc.size ?? 0,
        assetType,
    };
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

/**
 * Format bytes into a human-readable string.
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const index = Math.min(i, units.length - 1);
    const unit = units[index]!;
    const value = bytes / Math.pow(k, index);

    return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${unit}`;
}

/**
 * Get a human-readable label for an asset type.
 */
export function assetTypeLabel(type: AssetType): string {
    const labels: Record<AssetType, string> = {
        image: 'Image',
        video: 'Video',
        audio: 'Audio',
        font: 'Font',
    };
    return labels[type];
}

/**
 * Get the Material Community Icon name for an asset type.
 */
export function assetTypeIcon(type: AssetType): string {
    const icons: Record<AssetType, string> = {
        image: 'image',
        video: 'video',
        audio: 'music-note',
        font: 'format-font',
    };
    return icons[type];
}
