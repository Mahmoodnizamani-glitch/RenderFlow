/**
 * Caption template types and default configuration.
 *
 * Defines the interface for caption code generators and provides
 * default style configuration constants.
 */
import type {
    SrtFile,
    WordTiming,
    CaptionStyleId,
    CaptionStyleConfig,
} from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Template interface
// ---------------------------------------------------------------------------

export interface CaptionTemplate {
    /** Unique style identifier */
    readonly id: CaptionStyleId;
    /** Human-readable style name */
    readonly name: string;
    /** Short description of the animation effect */
    readonly description: string;
    /** Generates a complete Remotion component source string */
    generateCode(input: CaptionGeneratorInput): string;
}

// ---------------------------------------------------------------------------
// Generator input
// ---------------------------------------------------------------------------

export interface CaptionGeneratorInput {
    /** Parsed SRT file data */
    srtFile: SrtFile;
    /** Word-level timing data */
    wordTimings: WordTiming[];
    /** Style configuration */
    config: CaptionStyleConfig;
}

// ---------------------------------------------------------------------------
// Default style configurations
// ---------------------------------------------------------------------------

export const DEFAULT_STYLE_CONFIG: CaptionStyleConfig = {
    fontFamily: 'Inter',
    fontSize: 64,
    textColor: '#FFFFFF',
    highlightColor: '#FFD700',
    outlineColor: '#000000',
    outlineWeight: 4,
    position: 'bottom',
    background: 'none',
    backgroundColor: 'rgba(0,0,0,0.6)',
    aspect: '9:16',
    fps: 30,
};

// ---------------------------------------------------------------------------
// Position helpers (percentages for CSS top value)
// ---------------------------------------------------------------------------

export const POSITION_TOP_PERCENT: Record<CaptionStyleConfig['position'], number> = {
    top: 10,
    center: 45,
    bottom: 75,
} as const;
