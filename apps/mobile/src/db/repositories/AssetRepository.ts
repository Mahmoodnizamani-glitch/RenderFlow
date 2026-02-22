/**
 * Repository for Asset CRUD operations.
 *
 * All methods are async, return validated types, and throw AppError on failure.
 */
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import type { Asset, CreateAssetInput } from '@renderflow/shared';
import { AssetSchema } from '@renderflow/shared';
import { getDb } from '../client';
import { assets } from '../schema';
import { AppError } from '../../errors/AppError';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
    return new Date().toISOString();
}

function toAsset(row: typeof assets.$inferSelect): Asset {
    const parsed = AssetSchema.safeParse(row);

    if (!parsed.success) {
        throw AppError.validation(
            `Invalid asset data for id "${row.id}"`,
            new Error(parsed.error.message),
        );
    }

    return parsed.data;
}

// ---------------------------------------------------------------------------
// Storage usage result
// ---------------------------------------------------------------------------

export interface StorageUsage {
    totalBytes: number;
    count: number;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const AssetRepository = {
    async create(input: CreateAssetInput): Promise<Asset> {
        const db = getDb();
        const id = randomUUID();
        const timestamp = now();

        const values = {
            id,
            projectId: input.projectId,
            name: input.name,
            type: input.type,
            mimeType: input.mimeType,
            fileSize: input.fileSize,
            localUri: input.localUri ?? null,
            remoteUrl: input.remoteUrl ?? null,
            createdAt: timestamp,
        };

        try {
            await db.insert(assets).values(values);
        } catch (error: unknown) {
            throw AppError.database(
                `Failed to create asset "${input.name}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }

        return toAsset(values);
    },

    async getById(id: string): Promise<Asset> {
        const db = getDb();

        try {
            const rows = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
            const row = rows[0];

            if (!row) {
                throw AppError.notFound('Asset', id);
            }

            return toAsset(row);
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                `Failed to fetch asset "${id}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    async getByProject(projectId: string): Promise<Asset[]> {
        const db = getDb();

        try {
            const rows = await db
                .select()
                .from(assets)
                .where(eq(assets.projectId, projectId));
            return rows.map(toAsset);
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                `Failed to fetch assets for project "${projectId}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    async delete(id: string): Promise<void> {
        const db = getDb();

        try {
            await AssetRepository.getById(id);
            await db.delete(assets).where(eq(assets.id, id));
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                `Failed to delete asset "${id}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    async getStorageUsage(projectId?: string): Promise<StorageUsage> {
        const db = getDb();

        try {
            let query = db
                .select({
                    totalBytes: sql<number>`COALESCE(SUM(file_size), 0)`,
                    count: sql<number>`COUNT(*)`,
                })
                .from(assets);

            if (projectId) {
                query = query.where(eq(assets.projectId, projectId)) as typeof query;
            }

            const result = await query;
            return {
                totalBytes: result[0]?.totalBytes ?? 0,
                count: result[0]?.count ?? 0,
            };
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                'Failed to calculate storage usage',
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },
} as const;
