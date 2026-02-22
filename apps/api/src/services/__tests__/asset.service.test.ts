/**
 * Asset service unit tests.
 *
 * Tests file upload flow, listing, deleting, and presigned URL generation
 * with chainable mock database and mock storage service.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { StorageService } from '../storage.service.js';

// ---------------------------------------------------------------------------
// Mock storage service
// ---------------------------------------------------------------------------

function createMockStorage(): StorageService {
    return {
        uploadFile: vi.fn(async (_buffer, storagePath) => `https://r2.test/${storagePath}`),
        deleteFile: vi.fn(async () => undefined),
        generatePresignedUploadUrl: vi.fn(async (storagePath) => `https://r2.test/presigned/${storagePath}`),
        getPublicUrl: vi.fn((storagePath) => `https://r2.test/${storagePath}`),
    };
}

// ---------------------------------------------------------------------------
// Mock file validation
// ---------------------------------------------------------------------------

vi.mock('../../utils/file-validation.js', () => ({
    validateFile: vi.fn(() => ({ type: 'image', mime: 'image/png' })),
}));

// ---------------------------------------------------------------------------
// Mock asset row
// ---------------------------------------------------------------------------

interface MockAssetRow {
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

function createMockAssetRow(overrides?: Partial<MockAssetRow>): MockAssetRow {
    return {
        id: 'asset-001',
        userId: 'user-123',
        projectId: 'proj-001',
        name: 'image.png',
        type: 'image',
        mimeType: 'image/png',
        fileSize: 1024,
        storagePath: 'users/user-123/assets/asset-001/image.png',
        cdnUrl: 'https://r2.test/users/user-123/assets/asset-001/image.png',
        metadata: null,
        createdAt: new Date('2026-01-15T12:00:00Z'),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Chainable mock DB factory
// ---------------------------------------------------------------------------

function createChainableMockDb(options: {
    projectExists?: boolean;
    insertResult?: MockAssetRow[];
    selectResult?: MockAssetRow[];
}) {
    const projectRow = options.projectExists !== false ? [{ id: 'proj-001' }] : [];
    const insertResult = options.insertResult ?? [createMockAssetRow()];
    const assetSelectResult = options.selectResult ?? [createMockAssetRow()];

    // Track call count to differentiate between project lookup and asset lookup
    let selectCallCount = 0;

    // Select chain for project verification: select({id}).from(projects).where().limit()
    // Select chain for assets: select().from(assets).where()
    const selectChain = {
        from: vi.fn(() => selectChain),
        where: vi.fn(() => {
            // For calls that end with .where (no .limit), resolve to asset list
            return Object.assign(Promise.resolve(assetSelectResult), {
                limit: vi.fn(() => {
                    // For calls that end with .limit, return project or asset row
                    selectCallCount++;
                    if (selectCallCount === 1) {
                        return Promise.resolve(projectRow);
                    }
                    return Promise.resolve(assetSelectResult);
                }),
            });
        }),
    };

    const insertChain = {
        values: vi.fn(() => insertChain),
        returning: vi.fn(() => Promise.resolve(insertResult)),
    };

    const deleteChain = {
        where: vi.fn(() => Promise.resolve()),
    };

    return {
        select: vi.fn(() => selectChain),
        insert: vi.fn(() => insertChain),
        delete: vi.fn(() => deleteChain),
        _selectChain: selectChain,
        _insertChain: insertChain,
        _deleteChain: deleteChain,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('asset service', () => {
    let mockStorage: StorageService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockStorage = createMockStorage();
    });

    describe('createAssetFromUpload', () => {
        it('validates file, uploads to R2, inserts record, and returns asset row', async () => {
            const db = createChainableMockDb({ projectExists: true });
            const { createAssetFromUpload } = await import('../asset.service.js');
            const buffer = new Uint8Array(1024);

            const result = await createAssetFromUpload(
                db as never,
                'user-123',
                'proj-001',
                'image.png',
                buffer,
                mockStorage,
            );

            expect(mockStorage.uploadFile).toHaveBeenCalledOnce();
            expect(db.insert).toHaveBeenCalledOnce();
            expect(result.id).toBe('asset-001');
            expect(result.type).toBe('image');
        });

        it('throws not found when project does not exist', async () => {
            const db = createChainableMockDb({ projectExists: false });
            const { createAssetFromUpload } = await import('../asset.service.js');

            await expect(
                createAssetFromUpload(
                    db as never,
                    'user-123',
                    'nonexistent',
                    'file.png',
                    new Uint8Array(10),
                    mockStorage,
                ),
            ).rejects.toThrow(/not found/i);
        });

        it('cleans up R2 file when DB insert fails', async () => {
            const db = createChainableMockDb({ projectExists: true, insertResult: [] });
            const { createAssetFromUpload } = await import('../asset.service.js');

            await expect(
                createAssetFromUpload(
                    db as never,
                    'user-123',
                    'proj-001',
                    'file.png',
                    new Uint8Array(10),
                    mockStorage,
                ),
            ).rejects.toThrow(/failed to create/i);

            expect(mockStorage.deleteFile).toHaveBeenCalledOnce();
        });
    });

    describe('listProjectAssets', () => {
        it('returns assets for a project owned by the user', async () => {
            const db = createChainableMockDb({
                projectExists: true,
                selectResult: [createMockAssetRow()],
            });
            const { listProjectAssets } = await import('../asset.service.js');

            const result = await listProjectAssets(db as never, 'proj-001', 'user-123');

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(1);
        });

        it('throws not found when project does not exist', async () => {
            const db = createChainableMockDb({ projectExists: false });
            const { listProjectAssets } = await import('../asset.service.js');

            await expect(
                listProjectAssets(db as never, 'nonexistent', 'user-123'),
            ).rejects.toThrow(/not found/i);
        });
    });

    describe('deleteAsset', () => {
        it('deletes from R2 and database', async () => {
            const db = createChainableMockDb({
                selectResult: [createMockAssetRow()],
            });
            const { deleteAsset } = await import('../asset.service.js');

            await deleteAsset(db as never, 'asset-001', 'user-123', mockStorage);

            expect(mockStorage.deleteFile).toHaveBeenCalledOnce();
            expect(db.delete).toHaveBeenCalledOnce();
        });

        it('throws not found when asset does not exist', async () => {
            const db = createChainableMockDb({ selectResult: [] });
            // Override the limit to also return empty (deleteAsset uses limit)
            db._selectChain.where.mockReturnValueOnce(
                Object.assign(Promise.resolve([]), {
                    limit: vi.fn(() => Promise.resolve([])),
                }),
            );

            const { deleteAsset } = await import('../asset.service.js');

            await expect(
                deleteAsset(db as never, 'nonexistent', 'user-123', mockStorage),
            ).rejects.toThrow(/not found/i);
        });
    });

    describe('generateAssetPresignedUrl', () => {
        it('verifies project ownership and generates presigned URL', async () => {
            const db = createChainableMockDb({ projectExists: true });
            const { generateAssetPresignedUrl } = await import('../asset.service.js');

            const result = await generateAssetPresignedUrl(
                db as never,
                'user-123',
                'proj-001',
                'new-file.png',
                'image/png',
                mockStorage,
            );

            expect(result.url).toContain('presigned');
            expect(result.storagePath).toBeTruthy();
            expect(result.assetId).toBeTruthy();
        });

        it('throws not found when project does not exist', async () => {
            const db = createChainableMockDb({ projectExists: false });
            const { generateAssetPresignedUrl } = await import('../asset.service.js');

            await expect(
                generateAssetPresignedUrl(
                    db as never,
                    'user-123',
                    'nonexistent',
                    'file.png',
                    'image/png',
                    mockStorage,
                ),
            ).rejects.toThrow(/not found/i);
        });
    });
});
