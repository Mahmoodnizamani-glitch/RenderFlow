/**
 * @renderflow/shared — SRT subtitle file parser.
 *
 * Parses standard SRT format with lenient handling of minor formatting issues.
 * Supports multi-line text, HTML tags (<b>, <i>, <u>, <font>), and provides
 * validation warnings for overlapping timecodes and empty entries.
 */
import type { SrtEntry, SrtFile } from './types';
import { MAX_SRT_DURATION_MS, MAX_SRT_ENTRIES } from './types';

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/** Matches SRT timecodes: 00:00:00,000 --> 00:00:00,000 */
const TIMECODE_REGEX =
    /^\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*$/;

/** HTML tag pattern for stripping */
const HTML_TAG_REGEX = /<\/?(?:b|i|u|font|color)[^>]*>/gi;

// ---------------------------------------------------------------------------
// Timecode helpers
// ---------------------------------------------------------------------------

/**
 * Convert timecode components to milliseconds.
 */
function componentsToMs(
    hours: number,
    minutes: number,
    seconds: number,
    millis: number,
): number {
    return hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + millis;
}

/**
 * Parse a timecode line and return start/end in milliseconds.
 * Returns null if the format is invalid.
 */
function parseTimecodes(
    line: string,
): { startMs: number; endMs: number } | null {
    const match = TIMECODE_REGEX.exec(line);
    if (!match) return null;

    const startMs = componentsToMs(
        parseInt(match[1]!, 10),
        parseInt(match[2]!, 10),
        parseInt(match[3]!, 10),
        parseInt(padMillis(match[4]!), 10),
    );

    const endMs = componentsToMs(
        parseInt(match[5]!, 10),
        parseInt(match[6]!, 10),
        parseInt(match[7]!, 10),
        parseInt(padMillis(match[8]!), 10),
    );

    return { startMs, endMs };
}

/**
 * Pad milliseconds to 3 digits (e.g., "5" → "500", "50" → "500").
 */
function padMillis(ms: string): string {
    return ms.padEnd(3, '0');
}

/**
 * Strip HTML tags from subtitle text.
 */
function stripHtmlTags(text: string): string {
    return text.replace(HTML_TAG_REGEX, '').trim();
}

// ---------------------------------------------------------------------------
// Parser state machine
// ---------------------------------------------------------------------------

const enum ParseState {
    EXPECT_INDEX = 0,
    EXPECT_TIMECODE = 1,
    COLLECT_TEXT = 2,
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ParseSrtOptions {
    /** Skip entries where endMs <= startMs (default: true) */
    skipInvalidTiming?: boolean;
    /** Maximum allowed duration in ms (default: MAX_SRT_DURATION_MS) */
    maxDurationMs?: number;
}

/**
 * Parse an SRT string into a structured SrtFile.
 *
 * The parser is lenient — it collects warnings for minor issues rather
 * than throwing. Only fundamentally unparseable input causes an error.
 *
 * @param input - Raw SRT file content
 * @param options - Optional parsing configuration
 * @returns Parsed SRT file with entries and warnings
 * @throws Error if the input is completely empty or contains zero valid entries
 */
export function parseSrt(
    input: string,
    options: ParseSrtOptions = {},
): SrtFile {
    const { skipInvalidTiming = true, maxDurationMs = MAX_SRT_DURATION_MS } =
        options;

    const trimmedInput = input.trim();
    if (trimmedInput.length === 0) {
        throw new SrtParseError('SRT input is empty');
    }

    // Normalize line endings
    const lines = trimmedInput.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    const entries: SrtEntry[] = [];
    const warnings: string[] = [];

    let state: ParseState = ParseState.EXPECT_INDEX;
    let currentIndex = 0;
    let currentTimecodes: { startMs: number; endMs: number } | null = null;
    let currentTextLines: string[] = [];

    const flushEntry = (): void => {
        if (currentTimecodes && currentTextLines.length > 0) {
            const rawText = currentTextLines.join('\n');
            const plainText = stripHtmlTags(rawText);

            if (plainText.length === 0) {
                warnings.push(`Entry ${currentIndex}: text is empty after stripping HTML tags`);
                return;
            }

            if (skipInvalidTiming && currentTimecodes.endMs <= currentTimecodes.startMs) {
                warnings.push(
                    `Entry ${currentIndex}: end time (${currentTimecodes.endMs}ms) <= start time (${currentTimecodes.startMs}ms), skipped`,
                );
                return;
            }

            entries.push({
                index: currentIndex,
                startMs: currentTimecodes.startMs,
                endMs: currentTimecodes.endMs,
                rawText,
                plainText,
            });
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const trimmedLine = line.trim();

        switch (state) {
            case ParseState.EXPECT_INDEX: {
                if (trimmedLine.length === 0) {
                    // Skip blank lines between entries
                    continue;
                }
                // Check for timecode first — parseInt can falsely match
                // timecode lines (e.g. "00:00:01,000 --> ..." parses as 0)
                const tcDirect = parseTimecodes(trimmedLine);
                if (tcDirect) {
                    currentIndex = entries.length + 1;
                    currentTimecodes = tcDirect;
                    currentTextLines = [];
                    state = ParseState.COLLECT_TEXT;
                    warnings.push(
                        `Line ${i + 1}: missing index number, inferred as ${currentIndex}`,
                    );
                } else if (/^\d+$/.test(trimmedLine)) {
                    currentIndex = parseInt(trimmedLine, 10);
                    state = ParseState.EXPECT_TIMECODE;
                } else {
                    warnings.push(`Line ${i + 1}: expected entry index, got "${trimmedLine}"`);
                }
                break;
            }

            case ParseState.EXPECT_TIMECODE: {
                const tc = parseTimecodes(trimmedLine);
                if (!tc) {
                    warnings.push(
                        `Line ${i + 1}: expected timecode for entry ${currentIndex}, got "${trimmedLine}"`,
                    );
                    // Reset to look for next index
                    state = ParseState.EXPECT_INDEX;
                } else {
                    currentTimecodes = tc;
                    currentTextLines = [];
                    state = ParseState.COLLECT_TEXT;
                }
                break;
            }

            case ParseState.COLLECT_TEXT: {
                if (trimmedLine.length === 0) {
                    // Blank line = end of entry
                    flushEntry();
                    currentTimecodes = null;
                    currentTextLines = [];
                    state = ParseState.EXPECT_INDEX;
                } else {
                    currentTextLines.push(line.trim());
                }
                break;
            }
        }
    }

    // Flush the last entry if file doesn't end with blank line
    if (state === ParseState.COLLECT_TEXT) {
        flushEntry();
    }

    if (entries.length === 0) {
        throw new SrtParseError('No valid subtitle entries found in SRT input');
    }

    if (entries.length > MAX_SRT_ENTRIES) {
        throw new SrtParseError(
            `SRT file contains ${entries.length} entries, exceeding maximum of ${MAX_SRT_ENTRIES}`,
        );
    }

    // Validate overlapping timecodes
    for (let i = 1; i < entries.length; i++) {
        const prev = entries[i - 1]!;
        const curr = entries[i]!;
        if (curr.startMs < prev.endMs) {
            warnings.push(
                `Entry ${curr.index} overlaps with entry ${prev.index}: starts at ${curr.startMs}ms but previous ends at ${prev.endMs}ms`,
            );
        }
    }

    const totalDurationMs = entries[entries.length - 1]!.endMs;
    if (totalDurationMs > maxDurationMs) {
        warnings.push(
            `SRT duration (${totalDurationMs}ms) exceeds maximum of ${maxDurationMs}ms`,
        );
    }

    return {
        entries,
        totalEntries: entries.length,
        totalDurationMs,
        warnings,
    };
}

// ---------------------------------------------------------------------------
// Custom Error
// ---------------------------------------------------------------------------

export class SrtParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SrtParseError';
    }
}
