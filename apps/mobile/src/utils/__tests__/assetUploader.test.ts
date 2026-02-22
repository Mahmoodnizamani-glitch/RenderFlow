/**
 * assetUploader.test.ts — tests for asset upload utilities.
 */
import {
    detectAssetType,
    validateBeforeUpload,
    formatFileSize,
    assetTypeLabel,
    assetTypeIcon,
    MAX_FILE_SIZES,
    STORAGE_QUOTAS,
} from '../assetUploader';

// ---------------------------------------------------------------------------
// detectAssetType
// ---------------------------------------------------------------------------

describe('detectAssetType', () => {
    it('detects image MIME types', () => {
        expect(detectAssetType('image/jpeg')).toBe('image');
        expect(detectAssetType('image/png')).toBe('image');
        expect(detectAssetType('image/gif')).toBe('image');
        expect(detectAssetType('image/webp')).toBe('image');
        expect(detectAssetType('image/svg+xml')).toBe('image');
    });

    it('detects video MIME types', () => {
        expect(detectAssetType('video/mp4')).toBe('video');
        expect(detectAssetType('video/webm')).toBe('video');
        expect(detectAssetType('video/quicktime')).toBe('video');
    });

    it('detects audio MIME types', () => {
        expect(detectAssetType('audio/mpeg')).toBe('audio');
        expect(detectAssetType('audio/wav')).toBe('audio');
        expect(detectAssetType('audio/ogg')).toBe('audio');
    });

    it('detects font MIME types', () => {
        expect(detectAssetType('font/ttf')).toBe('font');
        expect(detectAssetType('font/otf')).toBe('font');
        expect(detectAssetType('font/woff')).toBe('font');
        expect(detectAssetType('font/woff2')).toBe('font');
        expect(detectAssetType('application/x-font-ttf')).toBe('font');
    });

    it('uses fallback heuristics for unknown subtypes', () => {
        expect(detectAssetType('image/bmp')).toBe('image');
        expect(detectAssetType('video/avi')).toBe('video');
        expect(detectAssetType('audio/flac')).toBe('audio');
    });

    it('returns null for unsupported types', () => {
        expect(detectAssetType('application/json')).toBeNull();
        expect(detectAssetType('text/plain')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// validateBeforeUpload
// ---------------------------------------------------------------------------

describe('validateBeforeUpload', () => {
    const quota = STORAGE_QUOTAS.free; // 500 MB

    it('passes for valid image within limits', () => {
        const result = validateBeforeUpload('image/png', 5 * 1024 * 1024, 0, quota);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
    });

    it('fails for unsupported MIME type', () => {
        const result = validateBeforeUpload('application/json', 100, 0, quota);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unsupported file type');
    });

    it('fails when file exceeds type-specific max size', () => {
        const oversize = MAX_FILE_SIZES.image + 1;
        const result = validateBeforeUpload('image/png', oversize, 0, quota);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('exceeds');
    });

    it('fails when upload would exceed storage quota', () => {
        const nearQuota = quota - 100;
        const result = validateBeforeUpload('image/png', 200, nearQuota, quota);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('storage quota');
    });

    it('passes when upload fits exactly within quota', () => {
        const nearQuota = quota - 1000;
        const result = validateBeforeUpload('image/png', 1000, nearQuota, quota);
        expect(result.valid).toBe(true);
    });

    it('validates video with higher size limit', () => {
        // 50 MB is under 100 MB video limit
        const result = validateBeforeUpload('video/mp4', 50 * 1024 * 1024, 0, quota);
        expect(result.valid).toBe(true);
    });

    it('fails for font file over 5 MB', () => {
        const oversize = MAX_FILE_SIZES.font + 1;
        const result = validateBeforeUpload('font/ttf', oversize, 0, quota);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('5 MB');
    });
});

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------

describe('formatFileSize', () => {
    it('formats 0 bytes', () => {
        expect(formatFileSize(0)).toBe('0 B');
    });

    it('formats bytes', () => {
        expect(formatFileSize(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
        expect(formatFileSize(1024)).toBe('1.0 KB');
    });

    it('formats megabytes', () => {
        expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    });

    it('formats gigabytes', () => {
        expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2.0 GB');
    });

    it('rounds large values', () => {
        expect(formatFileSize(15 * 1024 * 1024)).toBe('15 MB');
    });
});

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe('assetTypeLabel', () => {
    it('returns correct labels', () => {
        expect(assetTypeLabel('image')).toBe('Image');
        expect(assetTypeLabel('video')).toBe('Video');
        expect(assetTypeLabel('audio')).toBe('Audio');
        expect(assetTypeLabel('font')).toBe('Font');
    });
});

describe('assetTypeIcon', () => {
    it('returns correct icon names', () => {
        expect(assetTypeIcon('image')).toBe('image');
        expect(assetTypeIcon('video')).toBe('video');
        expect(assetTypeIcon('audio')).toBe('music-note');
        expect(assetTypeIcon('font')).toBe('format-font');
    });
});
