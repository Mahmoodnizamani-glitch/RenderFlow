/**
 * Tests for export settings constants and credit calculator.
 */
import {
    EXPORT_FORMATS,
    FORMAT_KEYS,
    DEFAULT_FORMAT,
    QUALITY_PRESETS,
    QUALITY_KEYS,
    DEFAULT_QUALITY,
    EXPORT_RESOLUTIONS,
    RESOLUTION_KEYS,
    DEFAULT_RESOLUTION,
    FPS_OPTIONS,
    DEFAULT_FPS,
    DEFAULT_RENDER_METHOD,
    calculateCreditEstimate,
    formatFileSize,
    generateOutputFilename,
    getAvailableResolutions,
} from '../exportSettings';

describe('exportSettings', () => {
    // -----------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------

    describe('constants', () => {
        it('has three format options', () => {
            expect(FORMAT_KEYS).toEqual(['mp4', 'webm', 'gif']);
        });

        it('defaults to mp4 format', () => {
            expect(DEFAULT_FORMAT).toBe('mp4');
        });

        it('has four quality presets', () => {
            expect(QUALITY_KEYS).toEqual(['draft', 'standard', 'high', 'maximum']);
        });

        it('defaults to high quality', () => {
            expect(DEFAULT_QUALITY).toBe('high');
            expect(QUALITY_PRESETS.high.value).toBe(80);
        });

        it('has four resolution options', () => {
            expect(RESOLUTION_KEYS).toEqual(['720p', '1080p', '1440p', '4k']);
        });

        it('defaults to 1080p resolution', () => {
            expect(DEFAULT_RESOLUTION).toBe('1080p');
            expect(EXPORT_RESOLUTIONS['1080p'].width).toBe(1920);
            expect(EXPORT_RESOLUTIONS['1080p'].height).toBe(1080);
        });

        it('has three fps options', () => {
            expect(FPS_OPTIONS).toEqual([24, 30, 60]);
        });

        it('defaults to 30fps', () => {
            expect(DEFAULT_FPS).toBe(30);
        });

        it('defaults to cloud render method', () => {
            expect(DEFAULT_RENDER_METHOD).toBe('cloud');
        });

        it('mp4 uses H.264 codec', () => {
            expect(EXPORT_FORMATS.mp4.codec).toBe('H.264');
        });

        it('webm uses VP9 codec', () => {
            expect(EXPORT_FORMATS.webm.codec).toBe('VP9');
        });

        it('gif has 0.5x credit multiplier', () => {
            expect(EXPORT_FORMATS.gif.creditMultiplier).toBe(0.5);
        });

        it('gif disables fps selector', () => {
            expect(EXPORT_FORMATS.gif.fpsSelectorEnabled).toBe(false);
        });

        it('gif max resolution is 1080p', () => {
            expect(EXPORT_FORMATS.gif.maxResolution).toBe('1080p');
        });

        it('4k has 2x credit multiplier', () => {
            expect(EXPORT_RESOLUTIONS['4k'].creditMultiplier).toBe(2);
        });

        it('1440p has 1.5x credit multiplier', () => {
            expect(EXPORT_RESOLUTIONS['1440p'].creditMultiplier).toBe(1.5);
        });
    });

    // -----------------------------------------------------------------
    // getAvailableResolutions
    // -----------------------------------------------------------------

    describe('getAvailableResolutions', () => {
        it('returns all resolutions for mp4', () => {
            expect(getAvailableResolutions('mp4')).toEqual(['720p', '1080p', '1440p', '4k']);
        });

        it('returns all resolutions for webm', () => {
            expect(getAvailableResolutions('webm')).toEqual(['720p', '1080p', '1440p', '4k']);
        });

        it('caps gif at 1080p', () => {
            expect(getAvailableResolutions('gif')).toEqual(['720p', '1080p']);
        });
    });

    // -----------------------------------------------------------------
    // calculateCreditEstimate
    // -----------------------------------------------------------------

    describe('calculateCreditEstimate', () => {
        it('calculates credits for a basic 1080p mp4 render', () => {
            const result = calculateCreditEstimate({
                durationInFrames: 150,
                fps: 30,
                format: 'mp4',
                quality: 'high',
                resolution: '1080p',
            });
            // 150/30 = 5 seconds = 5/60 minutes ≈ 0.083 minutes
            // 0.083 * 1 (mp4) * 1 (1080p) ≈ 0.08 credits
            expect(result.credits).toBe(0.08);
            expect(result.durationSeconds).toBe(5);
            expect(result.estimatedFileSize).toBeGreaterThan(0);
        });

        it('doubles credits for 4k resolution', () => {
            const base = calculateCreditEstimate({
                durationInFrames: 1800,
                fps: 30,
                format: 'mp4',
                quality: 'high',
                resolution: '1080p',
            });
            const fourK = calculateCreditEstimate({
                durationInFrames: 1800,
                fps: 30,
                format: 'mp4',
                quality: 'high',
                resolution: '4k',
            });
            expect(fourK.credits).toBe(base.credits * 2);
        });

        it('halves credits for gif format', () => {
            const mp4Result = calculateCreditEstimate({
                durationInFrames: 1800,
                fps: 30,
                format: 'mp4',
                quality: 'high',
                resolution: '1080p',
            });
            const gifResult = calculateCreditEstimate({
                durationInFrames: 1800,
                fps: 30,
                format: 'gif',
                quality: 'high',
                resolution: '1080p',
            });
            expect(gifResult.credits).toBe(mp4Result.credits / 2);
        });

        it('applies 1.5x multiplier for 1440p', () => {
            const base = calculateCreditEstimate({
                durationInFrames: 1800,
                fps: 30,
                format: 'mp4',
                quality: 'high',
                resolution: '1080p',
            });
            const qhd = calculateCreditEstimate({
                durationInFrames: 1800,
                fps: 30,
                format: 'mp4',
                quality: 'high',
                resolution: '1440p',
            });
            expect(qhd.credits).toBe(base.credits * 1.5);
        });

        it('returns minimum 0.01 credits for very short renders', () => {
            const result = calculateCreditEstimate({
                durationInFrames: 1,
                fps: 60,
                format: 'gif',
                quality: 'draft',
                resolution: '720p',
            });
            expect(result.credits).toBe(0.01);
        });

        it('handles fps of 0 gracefully', () => {
            const result = calculateCreditEstimate({
                durationInFrames: 150,
                fps: 0,
                format: 'mp4',
                quality: 'high',
                resolution: '1080p',
            });
            expect(result.durationSeconds).toBe(150);
            expect(result.credits).toBeGreaterThan(0);
        });

        it('estimates larger file size for higher quality', () => {
            const draft = calculateCreditEstimate({
                durationInFrames: 300,
                fps: 30,
                format: 'mp4',
                quality: 'draft',
                resolution: '1080p',
            });
            const max = calculateCreditEstimate({
                durationInFrames: 300,
                fps: 30,
                format: 'mp4',
                quality: 'maximum',
                resolution: '1080p',
            });
            expect(max.estimatedFileSize).toBeGreaterThan(draft.estimatedFileSize);
        });
    });

    // -----------------------------------------------------------------
    // formatFileSize
    // -----------------------------------------------------------------

    describe('formatFileSize', () => {
        it('formats bytes', () => {
            expect(formatFileSize(512)).toBe('512 B');
        });

        it('formats kilobytes', () => {
            expect(formatFileSize(1536)).toBe('1.5 KB');
        });

        it('formats megabytes', () => {
            expect(formatFileSize(10 * 1024 * 1024)).toBe('10.0 MB');
        });

        it('formats gigabytes', () => {
            expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.50 GB');
        });
    });

    // -----------------------------------------------------------------
    // generateOutputFilename
    // -----------------------------------------------------------------

    describe('generateOutputFilename', () => {
        it('generates a filename with project name and extension', () => {
            const result = generateOutputFilename('My Project', 'mp4');
            expect(result).toMatch(/^my_project_\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.mp4$/);
        });

        it('uses webm extension for webm format', () => {
            const result = generateOutputFilename('Test', 'webm');
            expect(result).toMatch(/\.webm$/);
        });

        it('uses gif extension for gif format', () => {
            const result = generateOutputFilename('Test', 'gif');
            expect(result).toMatch(/\.gif$/);
        });

        it('sanitizes special characters from project name', () => {
            const result = generateOutputFilename('My @#$%^& Project!!!', 'mp4');
            expect(result).toMatch(/^my_project_/);
        });

        it('truncates long project names', () => {
            const longName = 'a'.repeat(100);
            const result = generateOutputFilename(longName, 'mp4');
            // Name part should be at most 50 chars
            const namePart = result.split('_2')[0] ?? '';
            expect(namePart.length).toBeLessThanOrEqual(50);
        });
    });
});
