/**
 * Tests for the caption code generator.
 *
 * Verifies that all 4 styles generate valid, non-empty Remotion code,
 * that the generated code contains expected imports and user config values.
 */
import { parseSrt, generateWordTimings } from '@renderflow/shared';
import type { CaptionStyleId, CaptionStyleConfig } from '@renderflow/shared';
import {
    generateCaptionCode,
    getAllTemplates,
    getTemplate,
    DEFAULT_STYLE_CONFIG,
} from '../';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_SRT = [
    '1',
    '00:00:01,000 --> 00:00:03,000',
    'Hello world',
    '',
    '2',
    '00:00:04,000 --> 00:00:06,000',
    'This is a test',
    '',
].join('\n');

function buildInput(styleId: CaptionStyleId, configOverrides?: Partial<CaptionStyleConfig>) {
    const srtFile = parseSrt(SAMPLE_SRT);
    const wordTimings = generateWordTimings(srtFile.entries);
    const config: CaptionStyleConfig = { ...DEFAULT_STYLE_CONFIG, ...configOverrides };
    return { srtFile, wordTimings, styleId, config };
}

// ---------------------------------------------------------------------------
// getAllTemplates / getTemplate
// ---------------------------------------------------------------------------

describe('getAllTemplates', () => {
    it('returns all 4 templates', () => {
        const templates = getAllTemplates();
        expect(templates).toHaveLength(4);
        const ids = templates.map((t) => t.id);
        expect(ids).toContain('hormozi');
        expect(ids).toContain('minimal');
        expect(ids).toContain('bounce');
        expect(ids).toContain('karaoke');
    });
});

describe('getTemplate', () => {
    it('returns a template by ID', () => {
        const t = getTemplate('hormozi');
        expect(t.id).toBe('hormozi');
        expect(t.name).toBe('Hormozi');
    });

    it('throws for unknown style', () => {
        expect(() => getTemplate('unknown' as CaptionStyleId)).toThrow('Unknown caption style');
    });
});

// ---------------------------------------------------------------------------
// generateCaptionCode — per style
// ---------------------------------------------------------------------------

const STYLE_IDS: CaptionStyleId[] = ['hormozi', 'minimal', 'bounce', 'karaoke'];

describe('generateCaptionCode', () => {
    it.each(STYLE_IDS)('generates non-empty code for %s style', (styleId) => {
        const code = generateCaptionCode(buildInput(styleId));
        expect(code.length).toBeGreaterThan(100);
    });

    it.each(STYLE_IDS)('includes Remotion imports for %s style', (styleId) => {
        const code = generateCaptionCode(buildInput(styleId));
        expect(code).toContain("from 'remotion'");
        expect(code).toContain('useCurrentFrame');
        expect(code).toContain('AbsoluteFill');
    });

    it.each(STYLE_IDS)('embeds subtitle data for %s style', (styleId) => {
        const code = generateCaptionCode(buildInput(styleId));
        expect(code).toContain('SUBTITLE_ENTRIES');
        expect(code).toContain('Hello world');
        expect(code).toContain('This is a test');
    });

    it.each(STYLE_IDS)('includes Composition registration for %s style', (styleId) => {
        const code = generateCaptionCode(buildInput(styleId));
        expect(code).toContain('CaptionComposition');
        expect(code).toContain('Composition');
        expect(code).toContain('RemotionRoot');
    });

    it.each(STYLE_IDS)('includes auto-gen header for %s style', (styleId) => {
        const code = generateCaptionCode(buildInput(styleId));
        expect(code).toContain('Auto-generated caption component by RenderFlow');
    });

    // -----------------------------------------------------------------------
    // Config usage
    // -----------------------------------------------------------------------

    it('uses custom font family in generated code', () => {
        const code = generateCaptionCode(
            buildInput('hormozi', { fontFamily: 'Montserrat' }),
        );
        expect(code).toContain('Montserrat');
    });

    it('uses custom text color in generated code', () => {
        const code = generateCaptionCode(
            buildInput('minimal', { textColor: '#FF0000' }),
        );
        expect(code).toContain('#FF0000');
    });

    it('uses custom font size in generated code', () => {
        const code = generateCaptionCode(
            buildInput('bounce', { fontSize: 48 }),
        );
        expect(code).toContain('48');
    });

    it('uses custom highlight color for karaoke', () => {
        const code = generateCaptionCode(
            buildInput('karaoke', { highlightColor: '#00FF00' }),
        );
        expect(code).toContain('#00FF00');
    });

    it('uses correct dimensions for 16:9 aspect', () => {
        const code = generateCaptionCode(
            buildInput('hormozi', { aspect: '16:9' }),
        );
        expect(code).toContain('1920');
        expect(code).toContain('1080');
    });

    it('uses correct dimensions for 1:1 aspect', () => {
        const code = generateCaptionCode(
            buildInput('minimal', { aspect: '1:1' }),
        );
        // 1:1 is 1080x1080 — both width and height are 1080
        expect(code).toContain('1080');
    });

    it('calculates correct total frames from SRT duration and fps', () => {
        const code = generateCaptionCode(
            buildInput('minimal', { fps: 60 }),
        );
        // Total duration is 6000ms = 6s at 60fps = 360 frames
        expect(code).toContain('360');
        expect(code).toContain('fps={60}');
    });
});
