/**
 * Hormozi caption style — word-by-word highlight with pop animation.
 *
 * Generates Remotion code that displays subtitles word-by-word with:
 * - Yellow emphasis on the current word
 * - Scale pop animation using spring()
 * - Black outline, white base text
 */
import type { CaptionTemplate, CaptionGeneratorInput } from './types';
import { POSITION_TOP_PERCENT } from './types';
import { generateCommonImports, generateSubtitleData } from './codeGenUtils';

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export const hormoziTemplate: CaptionTemplate = {
    id: 'hormozi',
    name: 'Hormozi',
    description: 'Word-by-word highlight with pop animation — viral TikTok style',

    generateCode(input: CaptionGeneratorInput): string {
        const { config, wordTimings, srtFile } = input;
        const topPercent = POSITION_TOP_PERCENT[config.position];

        return `${generateCommonImports()}

${generateSubtitleData(srtFile, wordTimings)}

// ---------------------------------------------------------------------------
// Hormozi-style Caption Component
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
            <div
                style={{
                    position: 'absolute',
                    top: '${topPercent}%',
                    width: '90%',
                    textAlign: 'center',
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
                        <div key={entryIdx} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' }}>
                            {entryWords.map((wordData, wordIdx) => {
                                const isActive =
                                    currentTimeMs >= wordData.startMs &&
                                    currentTimeMs < wordData.endMs;

                                const wordFrame = Math.max(
                                    0,
                                    frame - Math.round((wordData.startMs / 1000) * fps),
                                );

                                const scale = isActive
                                    ? spring({
                                          frame: wordFrame,
                                          fps,
                                          config: { damping: 12, stiffness: 200, mass: 0.5 },
                                      }) * 0.15 + 1
                                    : 1;

                                return (
                                    <span
                                        key={wordIdx}
                                        style={{
                                            display: 'inline-block',
                                            fontFamily: '${config.fontFamily}',
                                            fontSize: ${config.fontSize},
                                            fontWeight: 800,
                                            color: isActive ? '${config.highlightColor}' : '${config.textColor}',
                                            textShadow: ${generateTextShadow(config.outlineColor, config.outlineWeight)},
                                            transform: \`scale(\${scale})\`,
                                            transition: 'color 0.05s',
                                        }}
                                    >
                                        {wordData.word}
                                    </span>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};

${generateComposition(input)}
`;
    },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateTextShadow(color: string, weight: number): string {
    return `\`\${[
        '${color} ${weight}px 0 0',
        '${color} -${weight}px 0 0',
        '${color} 0 ${weight}px 0',
        '${color} 0 -${weight}px 0',
        '${color} ${weight}px ${weight}px 0',
        '${color} -${weight}px ${weight}px 0',
        '${color} ${weight}px -${weight}px 0',
        '${color} -${weight}px -${weight}px 0',
    ].join(', ')}\``;
}

function generateComposition(input: CaptionGeneratorInput): string {
    const { config, srtFile } = input;
    const { width, height } = getAspectDimensions(config.aspect);
    const totalFrames = Math.ceil((srtFile.totalDurationMs / 1000) * config.fps);

    return `// ---------------------------------------------------------------------------
// Composition registration
// ---------------------------------------------------------------------------

export const RemotionRoot: React.FC = () => {
    return (
        <Composition
            id="Captions"
            component={CaptionComposition}
            durationInFrames={${totalFrames}}
            fps={${config.fps}}
            width={${width}}
            height={${height}}
        />
    );
};`;
}

function getAspectDimensions(aspect: string): { width: number; height: number } {
    const map: Record<string, { width: number; height: number }> = {
        '16:9': { width: 1920, height: 1080 },
        '9:16': { width: 1080, height: 1920 },
        '1:1': { width: 1080, height: 1080 },
    };
    return map[aspect] ?? { width: 1080, height: 1920 };
}
