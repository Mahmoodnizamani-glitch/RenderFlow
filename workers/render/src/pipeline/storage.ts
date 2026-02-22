/**
 * R2 storage client for the render worker.
 *
 * Handles uploading rendered files from disk to Cloudflare R2.
 * Uses streaming to avoid loading entire files into memory.
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import type { WorkerEnv } from '../config/env.js';
import { logger } from '../config/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StorageClient {
    uploadFile(localPath: string, storagePath: string, contentType: string): Promise<string>;
    getPublicUrl(storagePath: string): string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a storage client connected to R2.
 */
export function createStorageClient(env: WorkerEnv): StorageClient {
    const s3 = new S3Client({
        region: 'auto',
        endpoint: env.R2_ENDPOINT,
        credentials: {
            accessKeyId: env.R2_ACCESS_KEY,
            secretAccessKey: env.R2_SECRET_KEY,
        },
    });

    const bucket = env.R2_BUCKET;
    const publicBaseUrl = env.R2_ENDPOINT.replace(/\/+$/, '');

    function getPublicUrl(storagePath: string): string {
        return `${publicBaseUrl}/${bucket}/${storagePath}`;
    }

    async function uploadFile(
        localPath: string,
        storagePath: string,
        contentType: string,
    ): Promise<string> {
        const fileStat = await stat(localPath);
        const stream = createReadStream(localPath);

        logger.debug('Uploading file to R2', {
            storagePath,
            contentType,
            sizeBytes: fileStat.size,
        });

        await s3.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: storagePath,
                Body: stream,
                ContentType: contentType,
                ContentLength: fileStat.size,
            }),
        );

        return getPublicUrl(storagePath);
    }

    return { uploadFile, getPublicUrl };
}

// ---------------------------------------------------------------------------
// No-op client for tests
// ---------------------------------------------------------------------------

/**
 * Create a no-op storage client that returns placeholder URLs.
 * Used in test environments where R2 is not available.
 */
export function createNoOpStorageClient(): StorageClient {
    return {
        uploadFile: async (_localPath, storagePath, _contentType) => {
            return `https://r2-placeholder.dev/${storagePath}`;
        },
        getPublicUrl: (storagePath) => {
            return `https://r2-placeholder.dev/${storagePath}`;
        },
    };
}

// ---------------------------------------------------------------------------
// Storage path builder
// ---------------------------------------------------------------------------

/**
 * Build the R2 storage key for a rendered file.
 */
export function buildRenderStoragePath(
    userId: string,
    jobId: string,
    filename: string,
): string {
    return `renders/${userId}/${jobId}/${filename}`;
}
