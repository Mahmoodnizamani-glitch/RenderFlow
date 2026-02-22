/**
 * @renderflow/shared — SRT caption types and Zod schemas.
 *
 * Defines the data model for parsed SRT subtitle files, word-level timing,
 * and caption style configuration shared across the platform.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// SRT Entry — a single subtitle block
// ---------------------------------------------------------------------------

export const SrtEntrySchema = z.object({
    /** 1-based index from the SRT file */
    index: z.number().int().positive(),
    /** Start time in milliseconds */
    startMs: z.number().int().nonnegative(),
    /** End time in milliseconds */
    endMs: z.number().int().nonnegative(),
    /** Raw text (may contain HTML tags like <b>, <i>) */
    rawText: z.string(),
    /** Plain text with HTML tags stripped */
    plainText: z.string(),
});

export type SrtEntry = z.infer<typeof SrtEntrySchema>;

// ---------------------------------------------------------------------------
// SRT File — the full parsed result
// ---------------------------------------------------------------------------

export const SrtFileSchema = z.object({
    /** All subtitle entries, ordered by start time */
    entries: z.array(SrtEntrySchema),
    /** Total number of entries */
    totalEntries: z.number().int().nonnegative(),
    /** Total duration in milliseconds (end time of last entry) */
    totalDurationMs: z.number().int().nonnegative(),
    /** Non-fatal parsing warnings */
    warnings: z.array(z.string()),
});

export type SrtFile = z.infer<typeof SrtFileSchema>;

// ---------------------------------------------------------------------------
// Word Timing — word-level timing derived from phrase-level entries
// ---------------------------------------------------------------------------

export const WordTimingSchema = z.object({
    /** The word text */
    word: z.string(),
    /** Start time in milliseconds */
    startMs: z.number().int().nonnegative(),
    /** End time in milliseconds */
    endMs: z.number().int().nonnegative(),
    /** Index of the parent SRT entry */
    entryIndex: z.number().int().nonnegative(),
});

export type WordTiming = z.infer<typeof WordTimingSchema>;

// ---------------------------------------------------------------------------
// Caption Style — identifiers for built-in caption templates
// ---------------------------------------------------------------------------

export const CaptionStyleIdSchema = z.enum([
    'hormozi',
    'minimal',
    'bounce',
    'karaoke',
]);

export type CaptionStyleId = z.infer<typeof CaptionStyleIdSchema>;

// ---------------------------------------------------------------------------
// Caption Position
// ---------------------------------------------------------------------------

export const CaptionPositionSchema = z.enum(['top', 'center', 'bottom']);
export type CaptionPosition = z.infer<typeof CaptionPositionSchema>;

// ---------------------------------------------------------------------------
// Caption Background Mode
// ---------------------------------------------------------------------------

export const CaptionBackgroundSchema = z.enum(['none', 'solid', 'gradient']);
export type CaptionBackground = z.infer<typeof CaptionBackgroundSchema>;

// ---------------------------------------------------------------------------
// Video Aspect Ratio
// ---------------------------------------------------------------------------

export const VideoAspectSchema = z.enum(['16:9', '9:16', '1:1']);
export type VideoAspect = z.infer<typeof VideoAspectSchema>;

// ---------------------------------------------------------------------------
// Caption Style Config — full appearance configuration
// ---------------------------------------------------------------------------

export const CaptionStyleConfigSchema = z.object({
    /** Font family name */
    fontFamily: z.string().min(1).default('Inter'),
    /** Font size in pixels */
    fontSize: z.number().int().positive().default(64),
    /** Primary text color (hex) */
    textColor: z.string().default('#FFFFFF'),
    /** Highlight/emphasis color (hex) */
    highlightColor: z.string().default('#FFD700'),
    /** Outline/stroke color (hex) */
    outlineColor: z.string().default('#000000'),
    /** Outline weight in pixels */
    outlineWeight: z.number().nonnegative().default(4),
    /** Vertical position of captions */
    position: CaptionPositionSchema.default('bottom'),
    /** Background mode behind text */
    background: CaptionBackgroundSchema.default('none'),
    /** Background color (used for solid/gradient) */
    backgroundColor: z.string().default('rgba(0,0,0,0.6)'),
    /** Video aspect ratio */
    aspect: VideoAspectSchema.default('9:16'),
    /** Frames per second */
    fps: z.number().int().positive().default(30),
});

export type CaptionStyleConfig = z.infer<typeof CaptionStyleConfigSchema>;

// ---------------------------------------------------------------------------
// Aspect → Dimension mapping
// ---------------------------------------------------------------------------

export const ASPECT_DIMENSIONS: Record<VideoAspect, { width: number; height: number }> = {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
} as const;

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

/** Maximum supported SRT duration: 1 hour in milliseconds */
export const MAX_SRT_DURATION_MS = 3_600_000;

/** Maximum supported entry count */
export const MAX_SRT_ENTRIES = 10_000;
