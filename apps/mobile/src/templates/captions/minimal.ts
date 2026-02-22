/**
 * Minimal caption style — clean fade in/out per subtitle entry.
 *
 * Generates Remotion code that displays subtitle text with:
 * - Simple opacity fade in and fade out
 * - Center-aligned text, no effects
 * - Clean, professional look
 */
import type { CaptionTemplate, CaptionGeneratorInput } from './types';
import { POSITION_TOP_PERCENT } from './types';
import {
    generateCommonImports,
    generateSubtitleData,
    generateCompositionBlock,
} from './codeGenUtils';

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export const minimalTemplate: CaptionTemplate = {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean fade in/out — professional, distraction-free subtitles',

    generateCode(input: CaptionGeneratorInput): string {
        const { config, wordTimings, srtFile } = input;
        const topPercent = POSITION_TOP_PERCENT[config.position];
        const fadeDurationFrames = Math.round(config.fps * 0.15);

        return `${generateCommonImports()}

${generateSubtitleData(srtFile, wordTimings)}

// ---------------------------------------------------------------------------
// Minimal-style Caption Component
// ---------------------------------------------------------------------------

const FADE_FRAMES = ${fadeDurationFrames};

export const CaptionComposition: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const currentTimeMs = (frame / fps) * 1000;

    return (
        <AbsoluteFill
            style={{
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            {SUBTITLE_ENTRIES.map((entry, idx) => {
                if (currentTimeMs < entry.startMs || currentTimeMs > entry.endMs) {
                    return null;
                }

                const entryStartFrame = Math.round((entry.startMs / 1000) * fps);
                const entryEndFrame = Math.round((entry.endMs / 1000) * fps);
                const localFrame = frame - entryStartFrame;
                const framesUntilEnd = entryEndFrame - frame;

                const opacity = interpolate(
                    localFrame,
                    [0, FADE_FRAMES],
                    [0, 1],
                    { extrapolateRight: 'clamp' },
                ) * interpolate(
                    framesUntilEnd,
                    [0, FADE_FRAMES],
                    [0, 1],
                    { extrapolateRight: 'clamp' },
                );

                return (
                    <div
                        key={idx}
                        style={{
                            position: 'absolute',
                            top: '${topPercent}%',
                            width: '85%',
                            textAlign: 'center',
                            opacity,
                            fontFamily: '${config.fontFamily}',
                            fontSize: ${config.fontSize},
                            fontWeight: 600,
                            color: '${config.textColor}',
                            lineHeight: 1.3,${config.background !== 'none' ? `
                            backgroundColor: '${config.backgroundColor}',
                            padding: '12px 24px',
                            borderRadius: 8,` : ''}
                        }}
                    >
                        {entry.text}
                    </div>
                );
            })}
        </AbsoluteFill>
    );
};

${generateCompositionBlock(srtFile.totalDurationMs, config.fps, config.aspect)}
`;
    },
};
