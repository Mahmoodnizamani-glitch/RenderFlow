/**
 * Bounce caption style — words bounce in from bottom with spring animation.
 *
 * Generates Remotion code that displays subtitle words with:
 * - Staggered spring entrance from below
 * - Each word bounces into position sequentially
 * - Energetic, dynamic feel
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

export const bounceTemplate: CaptionTemplate = {
    id: 'bounce',
    name: 'Bounce',
    description: 'Words bounce in from below with spring animation — energetic feel',

    generateCode(input: CaptionGeneratorInput): string {
        const { config, wordTimings, srtFile } = input;
        const topPercent = POSITION_TOP_PERCENT[config.position];
        const outlineWeight = config.outlineWeight;
        const outlineColor = config.outlineColor;

        return `${generateCommonImports()}

${generateSubtitleData(srtFile, wordTimings)}

// ---------------------------------------------------------------------------
// Bounce-style Caption Component
// ---------------------------------------------------------------------------

const BOUNCE_DISTANCE = 60;
const STAGGER_FRAMES = 3;

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
            {SUBTITLE_ENTRIES.map((entry, entryIdx) => {
                if (currentTimeMs < entry.startMs || currentTimeMs > entry.endMs) {
                    return null;
                }

                const entryWords = WORD_TIMINGS.filter(
                    (w) => w.entryIndex === entryIdx,
                );

                const entryStartFrame = Math.round((entry.startMs / 1000) * fps);

                return (
                    <div
                        key={entryIdx}
                        style={{
                            position: 'absolute',
                            top: '${topPercent}%',
                            width: '90%',
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                            gap: '8px',
                        }}
                    >
                        {entryWords.map((wordData, wordIdx) => {
                            const delay = wordIdx * STAGGER_FRAMES;
                            const localFrame = Math.max(0, frame - entryStartFrame - delay);

                            const progress = spring({
                                frame: localFrame,
                                fps,
                                config: {
                                    damping: 8,
                                    stiffness: 180,
                                    mass: 0.6,
                                },
                            });

                            const translateY = interpolate(
                                progress,
                                [0, 1],
                                [BOUNCE_DISTANCE, 0],
                            );

                            const opacity = interpolate(
                                progress,
                                [0, 0.5],
                                [0, 1],
                                { extrapolateRight: 'clamp' },
                            );

                            return (
                                <span
                                    key={wordIdx}
                                    style={{
                                        display: 'inline-block',
                                        fontFamily: '${config.fontFamily}',
                                        fontSize: ${config.fontSize},
                                        fontWeight: 800,
                                        color: '${config.textColor}',
                                        textShadow: [
                                            '${outlineColor} ${outlineWeight}px 0 0',
                                            '${outlineColor} -${outlineWeight}px 0 0',
                                            '${outlineColor} 0 ${outlineWeight}px 0',
                                            '${outlineColor} 0 -${outlineWeight}px 0',
                                        ].join(', '),
                                        transform: \`translateY(\${translateY}px)\`,
                                        opacity,
                                    }}
                                >
                                    {wordData.word}
                                </span>
                            );
                        })}
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
