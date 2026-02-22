/**
 * Asset API module.
 *
 * Typed wrappers for the backend asset endpoints.
 * Supports presigned URL upload flow with progress tracking.
 */
import type { AssetType } from '@renderflow/shared';
import { apiClient } from './client';
import { API_BASE_URL } from './client';
import { getAccessToken } from './secureStorage';
import { mockAssets } from './mockData';

// ---------------------------------------------------------------------------
// Server response types
// ---------------------------------------------------------------------------

export interface ServerAsset {
    id: string;
    userId: string;
    projectId: string | null;
    name: string;
    type: string;
    mimeType: string;
    fileSize: number;
    storagePath: string;
    cdnUrl: string | null;
    metadata: unknown;
    createdAt: string;
}

interface AssetListResponse {
    data: ServerAsset[];
}

interface AssetResponse {
    asset: ServerAsset;
}

interface PresignedUrlResponse {
    url: string;
    storagePath: string;
    assetId: string;
}

// ---------------------------------------------------------------------------
// Upload progress callback
// ---------------------------------------------------------------------------

export type UploadProgressCallback = (progress: number) => void;

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Request a presigned PUT URL for direct R2 upload.
 * POST /assets/presigned-url
 */
export async function getPresignedUploadUrl(
    projectId: string,
    filename: string,
    contentType: string,
): Promise<PresignedUrlResponse> {
    const { data } = await apiClient.post<PresignedUrlResponse>(
        '/assets/presigned-url',
        { projectId, filename, contentType },
    );
    return data;
}

/**
 * Upload a file buffer directly to R2 via presigned URL.
 * Uses XMLHttpRequest for progress tracking.
 *
 * Returns the presigned URL used (for confirmation step).
 */
export function uploadToPresignedUrl(
    presignedUrl: string,
    fileBlob: Blob,
    contentType: string,
    onProgress?: UploadProgressCallback,
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignedUrl, true);
        xhr.setRequestHeader('Content-Type', contentType);

        if (onProgress) {
            xhr.upload.onprogress = (event: ProgressEvent) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    onProgress(percent);
                }
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
            } else {
                reject(new Error(`Upload failed with status ${xhr.status}`));
            }
        };

        xhr.onerror = () => {
            reject(new Error('Network error during upload'));
        };

        xhr.ontimeout = () => {
            reject(new Error('Upload timed out'));
        };

        xhr.timeout = 300_000; // 5 minutes
        xhr.send(fileBlob);
    });
}

/**
 * Upload a file via multipart to the backend.
 * POST /projects/:projectId/assets
 *
 * This is a simpler alternative to the presigned flow.
 * The backend handles R2 upload + DB record creation.
 */
export async function uploadAsset(
    projectId: string,
    fileUri: string,
    filename: string,
    mimeType: string,
    onProgress?: UploadProgressCallback,
): Promise<ServerAsset> {
    const formData = new FormData();

    // React Native FormData accepts objects with uri/name/type
    formData.append('file', {
        uri: fileUri,
        name: filename,
        type: mimeType,
    } as unknown as Blob);

    const token = await getAccessToken();

    return new Promise<ServerAsset>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}/api/v1/projects/${projectId}/assets`, true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        if (onProgress) {
            xhr.upload.onprogress = (event: ProgressEvent) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    onProgress(percent);
                }
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText) as AssetResponse;
                    resolve(response.asset);
                } catch {
                    reject(new Error('Failed to parse upload response'));
                }
            } else {
                reject(new Error(`Upload failed with status ${xhr.status}`));
            }
        };

        xhr.onerror = () => {
            reject(new Error('Network error during upload'));
        };

        xhr.ontimeout = () => {
            reject(new Error('Upload timed out'));
        };

        xhr.timeout = 300_000;
        xhr.send(formData);
    });
}

/**
 * List all assets for a project.
 * GET /projects/:projectId/assets
 */
export async function fetchProjectAssets(
    projectId: string,
): Promise<ServerAsset[]> {
    try {
        const { data } = await apiClient.get<AssetListResponse>(
            `/projects/${projectId}/assets`,
        );
        return data.data;
    } catch (e) {
        console.warn('Backend unavailable, returning mock assets');
        return mockAssets;
    }
}

/**
 * Delete an asset (removes from R2 + DB).
 * DELETE /assets/:assetId
 */
export async function deleteRemoteAsset(
    assetId: string,
): Promise<void> {
    await apiClient.delete(`/assets/${assetId}`);
}

// ---------------------------------------------------------------------------
// Mapper: Server → local Asset shape
// ---------------------------------------------------------------------------

export function serverAssetToLocal(server: ServerAsset) {
    return {
        id: server.id,
        projectId: server.projectId ?? '',
        name: server.name,
        type: server.type as AssetType,
        mimeType: server.mimeType,
        fileSize: server.fileSize,
        localUri: null as string | null,
        remoteUrl: server.cdnUrl,
        createdAt: server.createdAt,
    };
}
