/**
 * Export settings constants, types, and credit calculator.
 *
 * Defines format presets, quality levels, resolution options, fps choices,
 * and the credit cost estimation function.
 */

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

export interface FormatOption {
    readonly key: ExportFormat;
    readonly label: string;
    readonly codec: string;
    readonly extension: string;
    /** Credit multiplier (GIF = 0.5x) */
    readonly creditMultiplier: number;
    /** Maximum resolution key allowed for this format */
    readonly maxResolution: ExportResolutionKey | null;
    /** Whether FPS selection is available */
    readonly fpsSelectorEnabled: boolean;
}

export type ExportFormat = 'mp4' | 'webm' | 'gif';

export const EXPORT_FORMATS: Record<ExportFormat, FormatOption> = {
    mp4: {
        key: 'mp4',
        label: 'MP4',
        codec: 'H.264',
        extension: '.mp4',
        creditMultiplier: 1,
        maxResolution: null,
        fpsSelectorEnabled: true,
    },
    webm: {
        key: 'webm',
        label: 'WebM',
        codec: 'VP9',
        extension: '.webm',
        creditMultiplier: 1,
        maxResolution: null,
        fpsSelectorEnabled: true,
    },
    gif: {
        key: 'gif',
        label: 'GIF',
        codec: 'GIF',
        extension: '.gif',
        creditMultiplier: 0.5,
        maxResolution: '1080p',
        fpsSelectorEnabled: false,
    },
} as const;

export const FORMAT_KEYS: readonly ExportFormat[] = ['mp4', 'webm', 'gif'] as const;
export const DEFAULT_FORMAT: ExportFormat = 'mp4';

// ---------------------------------------------------------------------------
// Quality
// ---------------------------------------------------------------------------

export interface QualityPreset {
    readonly key: ExportQualityKey;
    readonly label: string;
    readonly description: string;
    readonly value: number;
}

export type ExportQualityKey = 'draft' | 'standard' | 'high' | 'maximum';

export const QUALITY_PRESETS: Record<ExportQualityKey, QualityPreset> = {
    draft: { key: 'draft', label: 'Draft', description: 'Fast render, lower quality', value: 40 },
    standard: { key: 'standard', label: 'Standard', description: 'Balanced quality', value: 60 },
    high: { key: 'high', label: 'High', description: 'Recommended', value: 80 },
    maximum: { key: 'maximum', label: 'Maximum', description: 'Best quality, slower', value: 100 },
} as const;

export const QUALITY_KEYS: readonly ExportQualityKey[] = ['draft', 'standard', 'high', 'maximum'] as const;
export const DEFAULT_QUALITY: ExportQualityKey = 'high';

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export interface ResolutionOption {
    readonly key: ExportResolutionKey;
    readonly label: string;
    readonly width: number;
    readonly height: number;
    /** Resolution string for DB storage (e.g. "1920x1080") */
    readonly dbValue: string;
    /** Credit multiplier for this resolution */
    readonly creditMultiplier: number;
}

export type ExportResolutionKey = '720p' | '1080p' | '1440p' | '4k';

export const EXPORT_RESOLUTIONS: Record<ExportResolutionKey, ResolutionOption> = {
    '720p': { key: '720p', label: '720p', width: 1280, height: 720, dbValue: '1280x720', creditMultiplier: 0.75 },
    '1080p': { key: '1080p', label: '1080p', width: 1920, height: 1080, dbValue: '1920x1080', creditMultiplier: 1 },
    '1440p': { key: '1440p', label: '1440p', width: 2560, height: 1440, dbValue: '2560x1440', creditMultiplier: 1.5 },
    '4k': { key: '4k', label: '4K', width: 3840, height: 2160, dbValue: '3840x2160', creditMultiplier: 2 },
} as const;

export const RESOLUTION_KEYS: readonly ExportResolutionKey[] = ['720p', '1080p', '1440p', '4k'] as const;
export const DEFAULT_RESOLUTION: ExportResolutionKey = '1080p';

/**
 * Returns the list of resolution keys available for a given format.
 * GIF is capped at 1080p.
 */
export function getAvailableResolutions(format: ExportFormat): readonly ExportResolutionKey[] {
    const formatOption = EXPORT_FORMATS[format];
    if (!formatOption.maxResolution) {
        return RESOLUTION_KEYS;
    }
    const maxIdx = RESOLUTION_KEYS.indexOf(formatOption.maxResolution);
    if (maxIdx === -1) return RESOLUTION_KEYS;
    return RESOLUTION_KEYS.slice(0, maxIdx + 1);
}

// ---------------------------------------------------------------------------
// FPS
// ---------------------------------------------------------------------------

export type ExportFps = 24 | 30 | 60;

export const FPS_OPTIONS: readonly ExportFps[] = [24, 30, 60] as const;
export const DEFAULT_FPS: ExportFps = 30;

// ---------------------------------------------------------------------------
// Render Method
// ---------------------------------------------------------------------------

export type RenderMethod = 'cloud' | 'local';
export const DEFAULT_RENDER_METHOD: RenderMethod = 'cloud';

// ---------------------------------------------------------------------------
// Credit Calculator
// ---------------------------------------------------------------------------

/**
 * Pricing model:
 * - 1 credit = 1 minute of render time at 1080p, MP4/WebM
 * - 4K = 2x credits
 * - 1440p = 1.5x credits
 * - 720p = 0.75x credits
 * - GIF = 0.5x credits
 */

export interface CreditEstimate {
    /** Estimated credits for this render */
    credits: number;
    /** Duration of the composition in seconds */
    durationSeconds: number;
    /** Estimated file size in bytes (rough) */
    estimatedFileSize: number;
}

/** Average bitrates in bits per second by quality for MP4/WebM */
const BITRATE_TABLE: Record<ExportQualityKey, number> = {
    draft: 2_000_000,   // 2 Mbps
    standard: 5_000_000,   // 5 Mbps
    high: 10_000_000,  // 10 Mbps
    maximum: 20_000_000,  // 20 Mbps
};

/** GIF file size is roughly 3x video at same resolution due to lack of interframe compression */
const GIF_SIZE_MULTIPLIER = 3;

/**
 * Calculate estimated credits and file size for a render.
 */
export function calculateCreditEstimate(params: {
    durationInFrames: number;
    fps: number;
    format: ExportFormat;
    quality: ExportQualityKey;
    resolution: ExportResolutionKey;
}): CreditEstimate {
    const { durationInFrames, fps, format, quality, resolution } = params;

    const safeFps = Math.max(fps, 1);
    const durationSeconds = durationInFrames / safeFps;

    // Credit calculation - App is fully free
    const credits = 0;

    // File size estimation
    const baseBitrate = BITRATE_TABLE[quality];
    const resOption = EXPORT_RESOLUTIONS[resolution];
    const pixelRatio = (resOption.width * resOption.height) / (1920 * 1080);
    const adjustedBitrate = baseBitrate * pixelRatio;

    let estimatedFileSize: number;
    if (format === 'gif') {
        // GIF: use a lower bitrate basis but multiply by GIF overhead
        estimatedFileSize = Math.round((adjustedBitrate * durationSeconds * GIF_SIZE_MULTIPLIER) / 8);
    } else {
        estimatedFileSize = Math.round((adjustedBitrate * durationSeconds) / 8);
    }

    return { credits, durationSeconds, estimatedFileSize };
}

// ---------------------------------------------------------------------------
// File size formatting
// ---------------------------------------------------------------------------

/**
 * Format bytes into human-readable string (KB, MB, GB).
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ---------------------------------------------------------------------------
// Output filename generation
// ---------------------------------------------------------------------------

/**
 * Generate a default output filename from project name and timestamp.
 */
export function generateOutputFilename(projectName: string, format: ExportFormat): string {
    const sanitized = projectName
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .replace(/\s+/g, '_')
        .toLowerCase()
        .slice(0, 50);

    const timestamp = new Date()
        .toISOString()
        .replace(/[:T]/g, '-')
        .replace(/\..+$/, '');

    const ext = EXPORT_FORMATS[format].extension;
    return `${sanitized}_${timestamp}${ext}`;
}
