/**
 * Render video cache management.
 *
 * Downloads, tracks, and cleans up cached render videos
 * using expo-file-system. Enforces a configurable TTL (default 7 days).
 */
import * as FileSystem from 'expo-file-system';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_DIR = `${FileSystem.cacheDirectory}renders/`;
const DEFAULT_TTL_DAYS = 7;

// ---------------------------------------------------------------------------
// Directory management
// ---------------------------------------------------------------------------

async function ensureCacheDir(): Promise<void> {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Absolute path to a cached video file for a given job ID. */
export function getCachePath(jobId: string, format = 'mp4'): string {
    return `${CACHE_DIR}${jobId}.${format}`;
}

// ---------------------------------------------------------------------------
// Cache operations
// ---------------------------------------------------------------------------

/**
 * Check whether a cached video exists on disk for the given job.
 */
export async function isCached(jobId: string, format = 'mp4'): Promise<boolean> {
    const path = getCachePath(jobId, format);
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
}

/**
 * Get the size (in bytes) of a cached video for a specific job.
 * Returns 0 if not cached.
 */
export async function getCachedVideoSize(jobId: string, format = 'mp4'): Promise<number> {
    const path = getCachePath(jobId, format);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists || info.isDirectory) return 0;
    return info.size ?? 0;
}

/**
 * Calculate total size of all cached render videos.
 */
export async function getTotalCacheSize(): Promise<number> {
    try {
        const info = await FileSystem.getInfoAsync(CACHE_DIR);
        if (!info.exists) return 0;

        const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
        let total = 0;

        for (const file of files) {
            const fileInfo = await FileSystem.getInfoAsync(`${CACHE_DIR}${file}`);
            if (fileInfo.exists && !fileInfo.isDirectory) {
                total += fileInfo.size ?? 0;
            }
        }

        return total;
    } catch {
        return 0;
    }
}

/**
 * Download a video from a URL and cache it locally.
 * Returns the local file URI.
 */
export async function downloadAndCache(
    jobId: string,
    downloadUrl: string,
    format = 'mp4',
): Promise<string> {
    await ensureCacheDir();

    const localPath = getCachePath(jobId, format);

    // Skip re-download if already cached
    const existing = await FileSystem.getInfoAsync(localPath);
    if (existing.exists) return localPath;

    const result = await FileSystem.downloadAsync(downloadUrl, localPath);
    if (result.status !== 200) {
        // Clean up partial download
        await FileSystem.deleteAsync(localPath, { idempotent: true });
        throw new Error(`Download failed with status ${result.status}`);
    }

    return result.uri;
}

/**
 * Clear a single cached video.
 */
export async function clearCachedVideo(jobId: string, format = 'mp4'): Promise<void> {
    const path = getCachePath(jobId, format);
    await FileSystem.deleteAsync(path, { idempotent: true });
}

/**
 * Clear ALL cached render videos.
 */
export async function clearAllCache(): Promise<void> {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (info.exists) {
        await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    }
}

/**
 * Remove cached videos older than the specified TTL.
 * Filenames are expected to be `<jobId>.<format>`.
 */
export async function cleanExpiredCache(ttlDays = DEFAULT_TTL_DAYS): Promise<number> {
    let removedCount = 0;

    try {
        const info = await FileSystem.getInfoAsync(CACHE_DIR);
        if (!info.exists) return 0;

        const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
        const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1000;

        for (const file of files) {
            const filePath = `${CACHE_DIR}${file}`;
            const fileInfo = await FileSystem.getInfoAsync(filePath);

            if (fileInfo.exists && !fileInfo.isDirectory) {
                // expo-file-system getInfoAsync returns modificationTime as seconds
                const modTime = (fileInfo.modificationTime ?? 0) * 1000;
                if (modTime > 0 && modTime < cutoff) {
                    await FileSystem.deleteAsync(filePath, { idempotent: true });
                    removedCount++;
                }
            }
        }
    } catch {
        // Swallow errors — cache cleanup is best-effort
    }

    return removedCount;
}

/**
 * Format bytes to human-readable string.
 */
export function formatCacheSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
    const value = bytes / Math.pow(k, i);

    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
