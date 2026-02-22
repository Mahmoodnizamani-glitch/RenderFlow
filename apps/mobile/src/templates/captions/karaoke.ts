/**
 * Karaoke caption style — word-by-word color fill from left to right.
 *
 * Generates Remotion code that displays subtitles with:
 * - Words colored progressively as they are "spoken"
 * - Current word partially filled using gradient
 * - Karaoke/sing-along visual effect
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

export const karaokeTemplate: CaptionTemplate = {
    id: 'karaoke',
    name: 'Karaoke',
    description: 'Word-by-word color fill sweep — sing-along style',

    generateCode(input: CaptionGeneratorInput): string {
        const { config, wordTimings, srtFile } = input;
        const topPercent = POSITION_TOP_PERCENT[config.position];

        return `${generateCommonImports()}

${generateSubtitleData(srtFile, wordTimings)}

// ---------------------------------------------------------------------------
// Karaoke-style Caption Component
// ---------------------------------------------------------------------------

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
                            const isPast = currentTimeMs >= wordData.endMs;
                            const isCurrent =
                                currentTimeMs >= wordData.startMs &&
                                currentTimeMs < wordData.endMs;

                            let fillPercent = 0;
                            if (isPast) {
                                fillPercent = 100;
                            } else if (isCurrent) {
                                const wordDuration = wordData.endMs - wordData.startMs;
                                const elapsed = currentTimeMs - wordData.startMs;
                                fillPercent = wordDuration > 0
                                    ? Math.round((elapsed / wordDuration) * 100)
                                    : 100;
                            }

                            const color = fillPercent >= 100
                                ? '${config.highlightColor}'
                                : fillPercent > 0
                                    ? undefined
                                    : '${config.textColor}';

                            const backgroundStyle = fillPercent > 0 && fillPercent < 100
                                ? {
                                      background: \`linear-gradient(90deg, ${'${config.highlightColor}'} \${fillPercent}%, ${'${config.textColor}'} \${fillPercent}%)\`,
                                      WebkitBackgroundClip: 'text' as const,
                                      WebkitTextFillColor: 'transparent' as const,
                                      backgroundClip: 'text' as const,
                                  }
                                : {};

                            return (
                                <span
                                    key={wordIdx}
                                    style={{
                                        display: 'inline-block',
                                        fontFamily: '${config.fontFamily}',
                                        fontSize: ${config.fontSize},
                                        fontWeight: 700,
                                        ...(color ? { color } : {}),
                                        ...backgroundStyle,
                                        textShadow: fillPercent > 0 && fillPercent < 100
                                            ? 'none'
                                            : [
                                                  '${config.outlineColor} ${config.outlineWeight}px 0 0',
                                                  '${config.outlineColor} -${config.outlineWeight}px 0 0',
                                                  '${config.outlineColor} 0 ${config.outlineWeight}px 0',
                                                  '${config.outlineColor} 0 -${config.outlineWeight}px 0',
                                              ].join(', '),
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
