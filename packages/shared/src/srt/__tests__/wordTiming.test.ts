/**
 * Tests for word-level timing generation.
 *
 * Covers proportional distribution, single-word entries, multi-word entries,
 * edge cases with empty text, and punctuation handling.
 */
import { generateWordTimings, generateEntryWordTimings } from '../wordTiming';
import type { SrtEntry } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<SrtEntry> = {}): SrtEntry {
    return {
        index: 1,
        startMs: 0,
        endMs: 3000,
        rawText: 'Hello world test',
        plainText: 'Hello world test',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// generateWordTimings
// ---------------------------------------------------------------------------

describe('generateWordTimings', () => {
    it('generates timings for all entries', () => {
        const entries: SrtEntry[] = [
            makeEntry({ index: 1, startMs: 0, endMs: 2000, plainText: 'Hello world' }),
            makeEntry({ index: 2, startMs: 3000, endMs: 5000, plainText: 'Foo bar' }),
        ];

        const timings = generateWordTimings(entries);

        expect(timings).toHaveLength(4);
        expect(timings[0]!.entryIndex).toBe(0);
        expect(timings[1]!.entryIndex).toBe(0);
        expect(timings[2]!.entryIndex).toBe(1);
        expect(timings[3]!.entryIndex).toBe(1);
    });

    it('returns empty array for empty entries', () => {
        expect(generateWordTimings([])).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// generateEntryWordTimings
// ---------------------------------------------------------------------------

describe('generateEntryWordTimings', () => {
    it('handles a single word entry', () => {
        const entry = makeEntry({ startMs: 1000, endMs: 2000, plainText: 'Hello' });
        const timings = generateEntryWordTimings(entry, 0);

        expect(timings).toHaveLength(1);
        expect(timings[0]).toEqual({
            word: 'Hello',
            startMs: 1000,
            endMs: 2000,
            entryIndex: 0,
        });
    });

    it('distributes time proportionally by character length', () => {
        // "Hi" (2 chars) + "World" (5 chars) = 7 chars over 7000ms
        // "Hi" gets ~2000ms, "World" gets ~5000ms
        const entry = makeEntry({ startMs: 0, endMs: 7000, plainText: 'Hi World' });
        const timings = generateEntryWordTimings(entry, 0);

        expect(timings).toHaveLength(2);
        expect(timings[0]!.word).toBe('Hi');
        expect(timings[1]!.word).toBe('World');

        // Proportional: Hi = round(2/7 * 7000) = 2000ms
        expect(timings[0]!.startMs).toBe(0);
        expect(timings[0]!.endMs).toBe(2000);

        // World gets the rest: 7000 - 2000 = 5000ms
        expect(timings[1]!.startMs).toBe(2000);
        expect(timings[1]!.endMs).toBe(7000);
    });

    it('ensures last word ends exactly at entry endMs (no rounding drift)', () => {
        const entry = makeEntry({ startMs: 0, endMs: 10000, plainText: 'One Two Three' });
        const timings = generateEntryWordTimings(entry, 0);
        const last = timings[timings.length - 1]!;

        expect(last.endMs).toBe(10000);
    });

    it('ensures all timings are contiguous', () => {
        const entry = makeEntry({ startMs: 500, endMs: 8500, plainText: 'A longer sentence with five words' });
        const timings = generateEntryWordTimings(entry, 0);

        for (let i = 1; i < timings.length; i++) {
            expect(timings[i]!.startMs).toBe(timings[i - 1]!.endMs);
        }
        expect(timings[0]!.startMs).toBe(500);
        expect(timings[timings.length - 1]!.endMs).toBe(8500);
    });

    it('returns empty for zero-duration entry', () => {
        const entry = makeEntry({ startMs: 1000, endMs: 1000, plainText: 'Hello' });
        expect(generateEntryWordTimings(entry, 0)).toEqual([]);
    });

    it('returns empty for empty text', () => {
        const entry = makeEntry({ startMs: 0, endMs: 3000, plainText: '' });
        expect(generateEntryWordTimings(entry, 0)).toEqual([]);
    });

    it('returns empty for whitespace-only text', () => {
        const entry = makeEntry({ startMs: 0, endMs: 3000, plainText: '   ' });
        expect(generateEntryWordTimings(entry, 0)).toEqual([]);
    });

    it('preserves punctuation attached to words', () => {
        const entry = makeEntry({ startMs: 0, endMs: 3000, plainText: 'Hello, world!' });
        const timings = generateEntryWordTimings(entry, 0);

        expect(timings).toHaveLength(2);
        expect(timings[0]!.word).toBe('Hello,');
        expect(timings[1]!.word).toBe('world!');
    });

    it('handles tabs and multiple spaces between words', () => {
        const entry = makeEntry({ startMs: 0, endMs: 3000, plainText: 'Tab\there  spaces' });
        const timings = generateEntryWordTimings(entry, 0);

        expect(timings).toHaveLength(3);
        expect(timings[0]!.word).toBe('Tab');
        expect(timings[1]!.word).toBe('here');
        expect(timings[2]!.word).toBe('spaces');
    });

    it('uses correct entryIndex', () => {
        const entry = makeEntry({ startMs: 0, endMs: 3000, plainText: 'Word' });
        const timings = generateEntryWordTimings(entry, 42);

        expect(timings[0]!.entryIndex).toBe(42);
    });
});
