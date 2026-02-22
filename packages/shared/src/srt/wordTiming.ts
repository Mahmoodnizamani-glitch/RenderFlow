/**
 * @renderflow/shared — Word-level timing generation.
 *
 * Generates word-level start/end times from phrase-level SRT entries
 * by distributing time proportionally based on character count.
 */
import type { SrtEntry, WordTiming } from './types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate word-level timing from an array of SRT entries.
 *
 * For each entry, the text is split into words and the entry's duration
 * is distributed proportionally by character length (longer words get
 * more time). This is an approximation — real word-level timing requires
 * speech recognition (e.g., Whisper).
 *
 * @param entries - Parsed SRT entries
 * @returns Array of word timings with start/end ms and parent entry index
 */
export function generateWordTimings(entries: readonly SrtEntry[]): WordTiming[] {
    const result: WordTiming[] = [];

    for (let entryIdx = 0; entryIdx < entries.length; entryIdx++) {
        const entry = entries[entryIdx]!;
        const entryTimings = generateEntryWordTimings(entry, entryIdx);
        result.push(...entryTimings);
    }

    return result;
}

/**
 * Generate word timings for a single SRT entry.
 *
 * @param entry - The SRT entry to split into words
 * @param entryIndex - The 0-based index of the entry in the source array
 * @returns Word timings for this entry
 */
export function generateEntryWordTimings(
    entry: SrtEntry,
    entryIndex: number,
): WordTiming[] {
    const words = splitIntoWords(entry.plainText);
    if (words.length === 0) return [];

    const duration = entry.endMs - entry.startMs;
    if (duration <= 0) return [];

    // Single word: gets the entire duration
    if (words.length === 1) {
        return [
            {
                word: words[0]!,
                startMs: entry.startMs,
                endMs: entry.endMs,
                entryIndex,
            },
        ];
    }

    // Calculate proportional time allocation based on character count
    const totalChars = words.reduce((sum, w) => sum + w.length, 0);

    // Guard against division by zero (e.g. all single-char punctuation)
    if (totalChars === 0) return [];

    const timings: WordTiming[] = [];
    let currentMs = entry.startMs;

    for (let i = 0; i < words.length; i++) {
        const word = words[i]!;
        const isLast = i === words.length - 1;

        // Last word gets all remaining time to avoid rounding drift
        const wordDuration = isLast
            ? entry.endMs - currentMs
            : Math.round((word.length / totalChars) * duration);

        timings.push({
            word,
            startMs: currentMs,
            endMs: currentMs + wordDuration,
            entryIndex,
        });

        currentMs += wordDuration;
    }

    return timings;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Split text into words, filtering out empty strings.
 * Preserves punctuation attached to words (e.g., "Hello," stays as one word).
 */
function splitIntoWords(text: string): string[] {
    return text
        .split(/\s+/)
        .filter((w) => w.length > 0);
}
