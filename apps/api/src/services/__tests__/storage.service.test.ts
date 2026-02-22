/**
 * Storage service unit tests.
 *
 * Tests the S3/R2 storage operations via the no-op service
 * and the buildAssetStoragePath utility.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import {
    buildAssetStoragePath,
    initStorage,
    resetStorage,
} from '../storage.service.js';
import type { Env } from '../../config/env.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('storage service', () => {
    beforeEach(() => {
        resetStorage();
    });

    describe('buildAssetStoragePath', () => {
        it('builds a standard storage path', () => {
            const path = buildAssetStoragePath('user-123', 'asset-456', 'photo.jpg');
            expect(path).toBe('users/user-123/assets/asset-456/photo.jpg');
        });

        it('handles filenames with spaces', () => {
            const path = buildAssetStoragePath('user-123', 'asset-001', 'my photo.jpg');
            expect(path).toBe('users/user-123/assets/asset-001/my photo.jpg');
        });

        it('handles filenames with special characters', () => {
            const path = buildAssetStoragePath('user-123', 'asset-001', 'file (1).png');
            expect(path).toBe('users/user-123/assets/asset-001/file (1).png');
        });
    });

    describe('initStorage (no-op / dev mode)', () => {
        it('returns a no-op storage service when R2 env vars are missing', () => {
            const env = {
                R2_ENDPOINT: '',
                R2_ACCESS_KEY: '',
                R2_SECRET_KEY: '',
                R2_BUCKET: 'test-bucket',
            } as unknown as Env;

            const service = initStorage(env);

            expect(service).toBeDefined();
            expect(service.uploadFile).toBeInstanceOf(Function);
            expect(service.deleteFile).toBeInstanceOf(Function);
            expect(service.generatePresignedUploadUrl).toBeInstanceOf(Function);
            expect(service.getPublicUrl).toBeInstanceOf(Function);
        });

        it('no-op uploadFile returns a placeholder URL', async () => {
            const env = { R2_ENDPOINT: '', R2_ACCESS_KEY: '', R2_SECRET_KEY: '', R2_BUCKET: '' } as unknown as Env;
            const service = initStorage(env);

            const url = await service.uploadFile(new Uint8Array(10), 'test/path.jpg', 'image/jpeg');

            expect(url).toContain('r2-placeholder');
            expect(url).toContain('test/path.jpg');
        });

        it('no-op deleteFile resolves without error', async () => {
            const env = { R2_ENDPOINT: '', R2_ACCESS_KEY: '', R2_SECRET_KEY: '', R2_BUCKET: '' } as unknown as Env;
            const service = initStorage(env);

            await expect(service.deleteFile('any/path')).resolves.toBeUndefined();
        });

        it('no-op generatePresignedUploadUrl returns a placeholder URL', async () => {
            const env = { R2_ENDPOINT: '', R2_ACCESS_KEY: '', R2_SECRET_KEY: '', R2_BUCKET: '' } as unknown as Env;
            const service = initStorage(env);

            const url = await service.generatePresignedUploadUrl('test/path.jpg', 'image/jpeg');

            expect(url).toContain('presigned');
            expect(url).toContain('test/path.jpg');
        });

        it('no-op getPublicUrl returns a placeholder URL', () => {
            const env = { R2_ENDPOINT: '', R2_ACCESS_KEY: '', R2_SECRET_KEY: '', R2_BUCKET: '' } as unknown as Env;
            const service = initStorage(env);

            const url = service.getPublicUrl('some/file.mp4');

            expect(url).toContain('r2-placeholder');
            expect(url).toContain('some/file.mp4');
        });
    });

    describe('resetStorage', () => {
        it('allows re-initialization after reset', () => {
            const env1 = { R2_ENDPOINT: '', R2_ACCESS_KEY: '', R2_SECRET_KEY: '', R2_BUCKET: '' } as unknown as Env;
            const service1 = initStorage(env1);

            resetStorage();

            const env2 = { R2_ENDPOINT: '', R2_ACCESS_KEY: '', R2_SECRET_KEY: '', R2_BUCKET: '' } as unknown as Env;
            const service2 = initStorage(env2);

            // Both should be valid, no shared state
            expect(service1).toBeDefined();
            expect(service2).toBeDefined();
        });
    });
});
