/**
 * Shared code generation utilities for caption templates.
 *
 * Provides helper functions for generating common Remotion imports,
 * embedding subtitle data, and formatting generated code.
 */
import type { SrtFile, WordTiming } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Common Remotion imports block
// ---------------------------------------------------------------------------

export function generateCommonImports(): string {
    return `import React from 'react';
import {
    AbsoluteFill,
    Composition,
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
} from 'remotion';`;
}

// ---------------------------------------------------------------------------
// Subtitle data embedding
// ---------------------------------------------------------------------------

/**
 * Generate const declarations for subtitle entries and word timings
 * that will be embedded in the generated Remotion component code.
 */
export function generateSubtitleData(
    srtFile: SrtFile,
    wordTimings: WordTiming[],
): string {
    const entriesJson = JSON.stringify(
        srtFile.entries.map((e) => ({
            startMs: e.startMs,
            endMs: e.endMs,
            text: e.plainText,
        })),
        null,
        4,
    );

    const timingsJson = JSON.stringify(
        wordTimings.map((w) => ({
            word: w.word,
            startMs: w.startMs,
            endMs: w.endMs,
            entryIndex: w.entryIndex,
        })),
        null,
        4,
    );

    return `// ---------------------------------------------------------------------------
// Subtitle Data (auto-generated from SRT)
// ---------------------------------------------------------------------------

const SUBTITLE_ENTRIES = ${entriesJson};

const WORD_TIMINGS = ${timingsJson};`;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Indent a multi-line string by a given number of spaces.
 */
export function indent(text: string, spaces: number): string {
    const pad = ' '.repeat(spaces);
    return text
        .split('\n')
        .map((line) => (line.trim().length > 0 ? pad + line : line))
        .join('\n');
}

/**
 * Get pixel dimensions for an aspect ratio string.
 */
export function getAspectDimensions(
    aspect: string,
): { width: number; height: number } {
    const map: Record<string, { width: number; height: number }> = {
        '16:9': { width: 1920, height: 1080 },
        '9:16': { width: 1080, height: 1920 },
        '1:1': { width: 1080, height: 1080 },
    };
    return map[aspect] ?? { width: 1080, height: 1920 };
}

/**
 * Calculate total frames from SRT duration and fps.
 */
export function calculateTotalFrames(
    totalDurationMs: number,
    fps: number,
): number {
    return Math.ceil((totalDurationMs / 1000) * fps);
}

/**
 * Generate the Composition registration block.
 */
export function generateCompositionBlock(
    totalDurationMs: number,
    fps: number,
    aspect: string,
): string {
    const { width, height } = getAspectDimensions(aspect);
    const totalFrames = calculateTotalFrames(totalDurationMs, fps);

    return `// ---------------------------------------------------------------------------
// Composition registration
// ---------------------------------------------------------------------------

export const RemotionRoot: React.FC = () => {
    return (
        <Composition
            id="Captions"
            component={CaptionComposition}
            durationInFrames={${totalFrames}}
            fps={${fps}}
            width={${width}}
            height={${height}}
        />
    );
};`;
}
