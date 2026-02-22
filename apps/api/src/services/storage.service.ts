/**
 * S3-compatible storage service for Cloudflare R2.
 *
 * Provides upload, delete, and presigned URL generation.
 * Never stores files on local disk — all operations go directly to R2.
 */
import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { Env } from '../config/env.js';

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _client: S3Client | null = null;
let _bucket: string = '';
let _publicBaseUrl: string = '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StorageService {
    uploadFile(buffer: Uint8Array, storagePath: string, contentType: string): Promise<string>;
    deleteFile(storagePath: string): Promise<void>;
    generatePresignedUploadUrl(storagePath: string, contentType: string, expiresInSeconds?: number): Promise<string>;
    getPublicUrl(storagePath: string): string;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * Initialise the S3 client singleton.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initStorage(env: Env): StorageService {
    if (!_client) {
        if (!env.R2_ENDPOINT || !env.R2_ACCESS_KEY || !env.R2_SECRET_KEY) {
            // Return a no-op storage service for dev/test when R2 is not configured
            return createNoOpStorageService();
        }

        _client = new S3Client({
            region: 'auto',
            endpoint: env.R2_ENDPOINT,
            credentials: {
                accessKeyId: env.R2_ACCESS_KEY,
                secretAccessKey: env.R2_SECRET_KEY,
            },
        });

        _bucket = env.R2_BUCKET;

        // Derive public URL from endpoint: remove the account hash path
        // Cloudflare R2 public URLs: https://<bucket>.<account>.r2.dev/<path>
        _publicBaseUrl = env.R2_ENDPOINT.replace(/\/+$/, '');
    }

    return createStorageService();
}

// ---------------------------------------------------------------------------
// Storage service factory
// ---------------------------------------------------------------------------

function createStorageService(): StorageService {
    return {
        uploadFile,
        deleteFile,
        generatePresignedUploadUrl,
        getPublicUrl,
    };
}

function createNoOpStorageService(): StorageService {
    return {
        uploadFile: async (_buffer, storagePath, _contentType) => {
            return `https://r2-placeholder.dev/${storagePath}`;
        },
        deleteFile: async () => {
            // no-op
        },
        generatePresignedUploadUrl: async (storagePath) => {
            return `https://r2-placeholder.dev/presigned/${storagePath}`;
        },
        getPublicUrl: (storagePath) => {
            return `https://r2-placeholder.dev/${storagePath}`;
        },
    };
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * Upload a file buffer to R2.
 * Returns the CDN URL of the uploaded file.
 */
async function uploadFile(
    buffer: Uint8Array,
    storagePath: string,
    contentType: string,
): Promise<string> {
    if (!_client) throw new Error('Storage not initialised');

    await _client.send(
        new PutObjectCommand({
            Bucket: _bucket,
            Key: storagePath,
            Body: buffer,
            ContentType: contentType,
        }),
    );

    return getPublicUrl(storagePath);
}

/**
 * Delete a file from R2.
 */
async function deleteFile(storagePath: string): Promise<void> {
    if (!_client) throw new Error('Storage not initialised');

    await _client.send(
        new DeleteObjectCommand({
            Bucket: _bucket,
            Key: storagePath,
        }),
    );
}

/**
 * Generate a presigned PUT URL for direct client upload.
 */
async function generatePresignedUploadUrl(
    storagePath: string,
    contentType: string,
    expiresInSeconds = 3600,
): Promise<string> {
    if (!_client) throw new Error('Storage not initialised');

    const command = new PutObjectCommand({
        Bucket: _bucket,
        Key: storagePath,
        ContentType: contentType,
    });

    return getSignedUrl(_client, command, { expiresIn: expiresInSeconds });
}

/**
 * Construct the public CDN URL for a stored file.
 */
function getPublicUrl(storagePath: string): string {
    return `${_publicBaseUrl}/${_bucket}/${storagePath}`;
}

// ---------------------------------------------------------------------------
// Storage path builder
// ---------------------------------------------------------------------------

/**
 * Build the standard storage key for an asset.
 */
export function buildAssetStoragePath(
    userId: string,
    assetId: string,
    filename: string,
): string {
    return `users/${userId}/assets/${assetId}/${filename}`;
}

/**
 * Reset storage singleton. **Test-only.**
 */
export function resetStorage(): void {
    _client = null;
    _bucket = '';
    _publicBaseUrl = '';
}
