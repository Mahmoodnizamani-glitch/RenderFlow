/**
 * Caption code generator — orchestrates template selection and code output.
 *
 * Takes SRT data, a style choice, and configuration, then delegates to
 * the correct template to produce a complete Remotion component string.
 */
import type { CaptionStyleId, SrtFile, WordTiming, CaptionStyleConfig } from '@renderflow/shared';
import type { CaptionTemplate, CaptionGeneratorInput } from './types';
import { hormoziTemplate } from './hormozi';
import { minimalTemplate } from './minimal';
import { bounceTemplate } from './bounce';
import { karaokeTemplate } from './karaoke';

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

const TEMPLATE_MAP: Record<CaptionStyleId, CaptionTemplate> = {
    hormozi: hormoziTemplate,
    minimal: minimalTemplate,
    bounce: bounceTemplate,
    karaoke: karaokeTemplate,
};

/**
 * Get all available caption templates.
 */
export function getAllTemplates(): readonly CaptionTemplate[] {
    return Object.values(TEMPLATE_MAP);
}

/**
 * Get a specific template by ID.
 *
 * @throws Error if the style ID is not recognized
 */
export function getTemplate(styleId: CaptionStyleId): CaptionTemplate {
    const template = TEMPLATE_MAP[styleId];
    if (!template) {
        throw new Error(`Unknown caption style: ${styleId}`);
    }
    return template;
}

// ---------------------------------------------------------------------------
// Main generation function
// ---------------------------------------------------------------------------

export interface GenerateCaptionCodeParams {
    /** Parsed SRT file */
    srtFile: SrtFile;
    /** Word-level timing data */
    wordTimings: WordTiming[];
    /** Selected caption style */
    styleId: CaptionStyleId;
    /** Style configuration */
    config: CaptionStyleConfig;
}

/**
 * Generate a complete Remotion component source code string for captions.
 *
 * The output is human-readable, self-contained code that only depends on
 * the `remotion` package. It can be saved as a project and further edited.
 *
 * @param params - Generation parameters
 * @returns Complete Remotion component source code
 */
export function generateCaptionCode(params: GenerateCaptionCodeParams): string {
    const { srtFile, wordTimings, styleId, config } = params;
    const template = getTemplate(styleId);

    const input: CaptionGeneratorInput = {
        srtFile,
        wordTimings,
        config,
    };

    const code = template.generateCode(input);

    // Add file header comment
    return `/**
 * Auto-generated caption component by RenderFlow.
 *
 * Style: ${template.name}
 * Entries: ${srtFile.totalEntries}
 * Duration: ${(srtFile.totalDurationMs / 1000).toFixed(1)}s
 * Generated: ${new Date().toISOString().split('T')[0]}
 */

${code}`;
}
