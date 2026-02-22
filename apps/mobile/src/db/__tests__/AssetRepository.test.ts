/**
 * Tests for AssetRepository.
 *
 * Mocks the Drizzle database layer to verify repository logic:
 * CRUD operations, getByProject, storageUsage, and error handling.
 */
import type { Asset } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const MOCK_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';
const PROJECT_UUID = '33333333-3333-4333-8333-333333333333';

jest.mock('expo-crypto', () => ({
    randomUUID: jest.fn(() => MOCK_UUID),
}));

function createSelectChain(rows: unknown[] = []) {
    const chain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => resolve(rows)),
    };
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    chain.orderBy.mockReturnValue(chain);
    return chain;
}

function createInsertChain() {
    return {
        values: jest.fn().mockResolvedValue(undefined),
    };
}

function createDeleteChain() {
    return {
        where: jest.fn().mockResolvedValue(undefined),
    };
}

jest.mock('../client', () => {
    const mockDb = {
        insert: jest.fn(),
        select: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    };
    return {
        getDb: jest.fn(() => mockDb),
    };
});

import { AssetRepository } from '../repositories/AssetRepository';
import { getDb } from '../client';
import { AppError as _AppError, ErrorCode } from '../../errors/AppError';

interface MockDb {
    insert: jest.Mock;
    select: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAsset(overrides: Partial<Asset> = {}): Asset {
    return {
        id: MOCK_UUID,
        projectId: PROJECT_UUID,
        name: 'photo.png',
        type: 'image',
        mimeType: 'image/png',
        fileSize: 1024000,
        localUri: '/path/to/photo.png',
        remoteUrl: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

function getDbMock(): MockDb {
    return (getDb as jest.Mock)() as MockDb;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AssetRepository', () => {
    let db: MockDb;

    beforeEach(() => {
        jest.clearAllMocks();
        db = getDbMock();
    });

    describe('create', () => {
        it('creates an asset with generated UUID and timestamp', async () => {
            const insertChain = createInsertChain();
            db.insert.mockReturnValue(insertChain);

            const asset = mockAsset();
            db.select.mockReturnValue(createSelectChain([asset]));

            const result = await AssetRepository.create({
                projectId: PROJECT_UUID,
                name: 'photo.png',
                type: 'image',
                mimeType: 'image/png',
                fileSize: 1024000,
            });

            expect(db.insert).toHaveBeenCalled();
            expect(insertChain.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: MOCK_UUID,
                    name: 'photo.png',
                    type: 'image',
                    projectId: PROJECT_UUID,
                }),
            );
            expect(result.id).toBe(MOCK_UUID);
        });

        it('throws AppError on database failure', async () => {
            db.insert.mockReturnValue({
                values: jest.fn().mockRejectedValue(new Error('Insert failed')),
            });

            await expect(
                AssetRepository.create({
                    projectId: PROJECT_UUID,
                    name: 'f.png',
                    type: 'image',
                    mimeType: 'image/png',
                    fileSize: 100,
                }),
            ).rejects.toMatchObject({ code: ErrorCode.DATABASE_ERROR });
        });
    });

    describe('getById', () => {
        it('returns asset when found', async () => {
            const asset = mockAsset();
            db.select.mockReturnValue(createSelectChain([asset]));

            const result = await AssetRepository.getById(MOCK_UUID);
            expect(result.id).toBe(MOCK_UUID);
            expect(result.name).toBe('photo.png');
        });

        it('throws NOT_FOUND when asset does not exist', async () => {
            db.select.mockReturnValue(createSelectChain([]));

            await expect(AssetRepository.getById('missing')).rejects.toMatchObject({
                code: ErrorCode.NOT_FOUND,
            });
        });
    });

    describe('getByProject', () => {
        it('returns all assets for a project', async () => {
            const a1 = mockAsset({ id: UUID_1, name: 'file1.png' });
            const a2 = mockAsset({ id: UUID_2, name: 'file2.mp4', type: 'video' });
            db.select.mockReturnValue(createSelectChain([a1, a2]));

            const results = await AssetRepository.getByProject(PROJECT_UUID);
            expect(results).toHaveLength(2);
        });

        it('returns empty array when no assets exist', async () => {
            db.select.mockReturnValue(createSelectChain([]));

            const results = await AssetRepository.getByProject(PROJECT_UUID);
            expect(results).toHaveLength(0);
        });
    });

    describe('delete', () => {
        it('deletes an existing asset', async () => {
            const asset = mockAsset();
            db.select.mockReturnValue(createSelectChain([asset]));
            db.delete.mockReturnValue(createDeleteChain());

            await expect(AssetRepository.delete(MOCK_UUID)).resolves.toBeUndefined();
            expect(db.delete).toHaveBeenCalled();
        });

        it('throws NOT_FOUND when deleting nonexistent asset', async () => {
            db.select.mockReturnValue(createSelectChain([]));

            await expect(AssetRepository.delete('nope')).rejects.toMatchObject({
                code: ErrorCode.NOT_FOUND,
            });
        });
    });

    describe('getStorageUsage', () => {
        it('returns total bytes and count', async () => {
            db.select.mockReturnValue(
                createSelectChain([{ totalBytes: 5242880, count: 10 }]),
            );

            const usage = await AssetRepository.getStorageUsage();
            expect(usage.totalBytes).toBe(5242880);
            expect(usage.count).toBe(10);
        });

        it('returns zero when no assets exist', async () => {
            db.select.mockReturnValue(
                createSelectChain([{ totalBytes: 0, count: 0 }]),
            );

            const usage = await AssetRepository.getStorageUsage(PROJECT_UUID);
            expect(usage.totalBytes).toBe(0);
            expect(usage.count).toBe(0);
        });
    });
});
