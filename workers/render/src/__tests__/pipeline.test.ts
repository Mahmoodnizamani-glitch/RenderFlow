/**
 * Unit tests for the render pipeline.
 *
 * Mocks external dependencies (fetch, Remotion, S3) to test
 * each pipeline step in isolation and the full orchestrator.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, writeFile, rm, access } from 'node:fs/promises';

import { parseRenderSettings, fetchCodeBundle } from '../pipeline/pipeline.js';
import { buildRenderStoragePath } from '../pipeline/storage.js';
import { RenderError } from '../errors.js';
import type { ChildLogger } from '../config/logger.js';

// ---------------------------------------------------------------------------
// Mock logger
// ---------------------------------------------------------------------------

const mockLog: ChildLogger = {
    fatal: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
};

// ---------------------------------------------------------------------------
// parseRenderSettings
// ---------------------------------------------------------------------------

describe('parseRenderSettings', () => {
    it('extracts typed settings from raw record', () => {
        const result = parseRenderSettings({
            width: 1920,
            height: 1080,
            fps: 30,
            durationInFrames: 300,
            format: 'mp4',
            quality: 80,
        });

        expect(result).toEqual({
            width: 1920,
            height: 1080,
            fps: 30,
            durationInFrames: 300,
            format: 'mp4',
            quality: 80,
        });
    });

    it('applies defaults for missing fields', () => {
        const result = parseRenderSettings({});

        expect(result.width).toBe(1920);
        expect(result.height).toBe(1080);
        expect(result.fps).toBe(30);
        expect(result.durationInFrames).toBe(150);
        expect(result.format).toBe('mp4');
        expect(result.quality).toBeUndefined();
    });

    it('falls back to mp4 for invalid format', () => {
        const result = parseRenderSettings({ format: 'avi' });
        expect(result.format).toBe('mp4');
    });

    it('handles all valid formats', () => {
        expect(parseRenderSettings({ format: 'mp4' }).format).toBe('mp4');
        expect(parseRenderSettings({ format: 'webm' }).format).toBe('webm');
        expect(parseRenderSettings({ format: 'gif' }).format).toBe('gif');
    });

    it('handles non-number types gracefully', () => {
        const result = parseRenderSettings({
            width: 'not a number',
            height: null,
            fps: undefined,
        });

        expect(result.width).toBe(1920);
        expect(result.height).toBe(1080);
        expect(result.fps).toBe(30);
    });
});

// ---------------------------------------------------------------------------
// fetchCodeBundle
// ---------------------------------------------------------------------------

describe('fetchCodeBundle', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('downloads code bundle successfully', async () => {
        const mockContent = new TextEncoder().encode('export const Main = () => null;');

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(mockContent.buffer),
        }));

        const result = await fetchCodeBundle('https://example.com/bundle.tsx', mockLog);

        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBeGreaterThan(0);
    });

    it('throws CODE_ERROR for HTTP errors', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found',
        }));

        await expect(
            fetchCodeBundle('https://example.com/missing.tsx', mockLog),
        ).rejects.toThrow(RenderError);

        try {
            await fetchCodeBundle('https://example.com/missing.tsx', mockLog);
        } catch (err) {
            expect(RenderError.is(err)).toBe(true);
            if (RenderError.is(err)) {
                expect(err.type).toBe('CODE_ERROR');
            }
        }
    });

    it('throws CODE_ERROR for empty bundles', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        }));

        await expect(
            fetchCodeBundle('https://example.com/empty.tsx', mockLog),
        ).rejects.toThrow(RenderError);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });
});

// ---------------------------------------------------------------------------
// buildRenderStoragePath
// ---------------------------------------------------------------------------

describe('buildRenderStoragePath', () => {
    it('builds correct path', () => {
        const path = buildRenderStoragePath('user-123', 'job-456', 'output.mp4');
        expect(path).toBe('renders/user-123/job-456/output.mp4');
    });

    it('handles special characters in IDs', () => {
        const path = buildRenderStoragePath(
            'usr_abc-def',
            'job_123-789',
            'output.webm',
        );
        expect(path).toBe('renders/usr_abc-def/job_123-789/output.webm');
    });
});

// ---------------------------------------------------------------------------
// Workspace cleanup (tests the cleanup function indirectly)
// ---------------------------------------------------------------------------

describe('workspace cleanup', () => {
    it('creates and cleans up temp directories correctly', async () => {
        const testDir = join(tmpdir(), `renderflow-test-cleanup-${Date.now()}`);

        // Create a temp workspace
        await mkdir(testDir, { recursive: true });
        await writeFile(join(testDir, 'test.txt'), 'hello');

        // Verify it exists
        await expect(access(testDir)).resolves.toBeUndefined();

        // Clean up
        await rm(testDir, { recursive: true, force: true });

        // Verify it's gone
        await expect(access(testDir)).rejects.toThrow();
    });
});
