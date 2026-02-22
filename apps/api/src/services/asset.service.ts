/**
 * Asset service.
 *
 * Manages file uploads to R2 storage and asset metadata in PostgreSQL.
 * All queries enforce user-ownership.
 */
import crypto from 'node:crypto';

import { eq, and } from 'drizzle-orm';

import type { Database } from '../db/connection.js';
import { assets, projects } from '../db/schema.js';
import { AppError } from '../errors/errors.js';
import type { StorageService } from './storage.service.js';
import { buildAssetStoragePath } from './storage.service.js';
import { validateFile } from '../utils/file-validation.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssetRow {
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
    createdAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toAssetRow(row: typeof assets.$inferSelect): AssetRow {
    return {
        id: row.id,
        userId: row.userId,
        projectId: row.projectId,
        name: row.name,
        type: row.type,
        mimeType: row.mimeType,
        fileSize: row.fileSize,
        storagePath: row.storagePath,
        cdnUrl: row.cdnUrl,
        metadata: row.metadata,
        createdAt: row.createdAt,
    };
}

// ---------------------------------------------------------------------------
// Create from upload
// ---------------------------------------------------------------------------

/**
 * Validate an uploaded file, store it in R2, and insert the asset record.
 */
export async function createAssetFromUpload(
    db: Database,
    userId: string,
    projectId: string,
    filename: string,
    buffer: Uint8Array,
    storage: StorageService,
): Promise<AssetRow> {
    // Verify the project exists and belongs to the user
    const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
        .limit(1);

    if (!project) {
        throw AppError.notFound('Project not found');
    }

    // Validate file type and size via magic bytes
    const detected = validateFile(buffer, filename);

    const assetId = crypto.randomUUID();
    const storagePath = buildAssetStoragePath(userId, assetId, filename);

    // Upload to R2
    const cdnUrl = await storage.uploadFile(buffer, storagePath, detected.mime);

    // Insert asset record
    const [inserted] = await db
        .insert(assets)
        .values({
            id: assetId,
            userId,
            projectId,
            name: filename,
            type: detected.type,
            mimeType: detected.mime,
            fileSize: buffer.length,
            storagePath,
            cdnUrl,
        })
        .returning();

    if (!inserted) {
        // Attempt cleanup of uploaded file
        try {
            await storage.deleteFile(storagePath);
        } catch {
            // Best-effort cleanup
        }
        throw AppError.internal('Failed to create asset record');
    }

    return toAssetRow(inserted);
}

// ---------------------------------------------------------------------------
// List by project
// ---------------------------------------------------------------------------

/**
 * List all assets for a project (owned by the requesting user).
 */
export async function listProjectAssets(
    db: Database,
    projectId: string,
    userId: string,
): Promise<AssetRow[]> {
    // Verify project ownership
    const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
        .limit(1);

    if (!project) {
        throw AppError.notFound('Project not found');
    }

    const rows = await db
        .select()
        .from(assets)
        .where(and(eq(assets.projectId, projectId), eq(assets.userId, userId)));

    return rows.map(toAssetRow);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete an asset: removes from both R2 storage and the database.
 */
export async function deleteAsset(
    db: Database,
    assetId: string,
    userId: string,
    storage: StorageService,
): Promise<void> {
    const [asset] = await db
        .select()
        .from(assets)
        .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
        .limit(1);

    if (!asset) {
        throw AppError.notFound('Asset not found');
    }

    // Delete from R2
    await storage.deleteFile(asset.storagePath);

    // Delete from DB
    await db
        .delete(assets)
        .where(eq(assets.id, assetId));
}

// ---------------------------------------------------------------------------
// Presigned URL
// ---------------------------------------------------------------------------

/**
 * Generate a presigned PUT URL for direct client upload.
 */
export async function generateAssetPresignedUrl(
    db: Database,
    userId: string,
    projectId: string,
    filename: string,
    contentType: string,
    storage: StorageService,
): Promise<{ url: string; storagePath: string; assetId: string }> {
    // Verify project ownership
    const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
        .limit(1);

    if (!project) {
        throw AppError.notFound('Project not found');
    }

    const assetId = crypto.randomUUID();
    const storagePath = buildAssetStoragePath(userId, assetId, filename);

    const url = await storage.generatePresignedUploadUrl(
        storagePath,
        contentType,
    );

    return { url, storagePath, assetId };
}
