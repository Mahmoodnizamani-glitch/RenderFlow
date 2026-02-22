/**
 * Tests for the SRT parser.
 *
 * Covers standard parsing, timecode edge cases, HTML tag stripping,
 * multi-line subtitles, validation warnings, and error cases.
 */
import { parseSrt, SrtParseError } from '../parser';

// ---------------------------------------------------------------------------
// Standard SRT parsing
// ---------------------------------------------------------------------------

describe('parseSrt', () => {
    const STANDARD_SRT = [
        '1',
        '00:00:01,000 --> 00:00:04,000',
        'Hello, world!',
        '',
        '2',
        '00:00:05,000 --> 00:00:08,000',
        'This is a test.',
        '',
    ].join('\n');

    it('parses a standard SRT file', () => {
        const result = parseSrt(STANDARD_SRT);

        expect(result.totalEntries).toBe(2);
        expect(result.entries).toHaveLength(2);
        expect(result.warnings).toHaveLength(0);

        expect(result.entries[0]).toEqual({
            index: 1,
            startMs: 1000,
            endMs: 4000,
            rawText: 'Hello, world!',
            plainText: 'Hello, world!',
        });

        expect(result.entries[1]).toEqual({
            index: 2,
            startMs: 5000,
            endMs: 8000,
            rawText: 'This is a test.',
            plainText: 'This is a test.',
        });
    });

    it('calculates total duration from last entry end time', () => {
        const result = parseSrt(STANDARD_SRT);
        expect(result.totalDurationMs).toBe(8000);
    });

    // -----------------------------------------------------------------------
    // Multi-line subtitles
    // -----------------------------------------------------------------------

    it('handles multi-line subtitle text', () => {
        const srt = [
            '1',
            '00:00:01,000 --> 00:00:04,000',
            'First line',
            'Second line',
            'Third line',
            '',
        ].join('\n');

        const result = parseSrt(srt);
        expect(result.entries[0]!.rawText).toBe('First line\nSecond line\nThird line');
        expect(result.entries[0]!.plainText).toBe('First line\nSecond line\nThird line');
    });

    // -----------------------------------------------------------------------
    // HTML tag stripping
    // -----------------------------------------------------------------------

    it('strips bold/italic/underline HTML tags', () => {
        const srt = [
            '1',
            '00:00:01,000 --> 00:00:04,000',
            '<b>Bold</b> and <i>italic</i> and <u>underline</u>',
            '',
        ].join('\n');

        const result = parseSrt(srt);
        expect(result.entries[0]!.rawText).toBe('<b>Bold</b> and <i>italic</i> and <u>underline</u>');
        expect(result.entries[0]!.plainText).toBe('Bold and italic and underline');
    });

    it('strips font tags with attributes', () => {
        const srt = [
            '1',
            '00:00:01,000 --> 00:00:04,000',
            '<font color="#FF0000">Red text</font>',
            '',
        ].join('\n');

        const result = parseSrt(srt);
        expect(result.entries[0]!.plainText).toBe('Red text');
    });

    // -----------------------------------------------------------------------
    // Timecode edge cases
    // -----------------------------------------------------------------------

    it('handles period as millisecond separator (common variant)', () => {
        const srt = [
            '1',
            '00:00:01.000 --> 00:00:04.000',
            'With periods',
            '',
        ].join('\n');

        const result = parseSrt(srt);
        expect(result.entries[0]!.startMs).toBe(1000);
        expect(result.entries[0]!.endMs).toBe(4000);
    });

    it('handles short milliseconds (1 or 2 digits)', () => {
        const srt = [
            '1',
            '00:00:01,5 --> 00:00:04,50',
            'Short ms',
            '',
        ].join('\n');

        const result = parseSrt(srt);
        expect(result.entries[0]!.startMs).toBe(1500);
        expect(result.entries[0]!.endMs).toBe(4500);
    });

    it('handles single-digit hours', () => {
        const srt = [
            '1',
            '0:05:30,000 --> 0:06:00,000',
            'Single digit hour',
            '',
        ].join('\n');

        const result = parseSrt(srt);
        expect(result.entries[0]!.startMs).toBe(330_000);
        expect(result.entries[0]!.endMs).toBe(360_000);
    });

    it('handles extra whitespace around timecodes', () => {
        const srt = [
            '1',
            '  00:00:01,000  -->  00:00:04,000  ',
            'Spaced out',
            '',
        ].join('\n');

        const result = parseSrt(srt);
        expect(result.entries[0]!.startMs).toBe(1000);
        expect(result.entries[0]!.endMs).toBe(4000);
    });

    // -----------------------------------------------------------------------
    // File ending without trailing newline
    // -----------------------------------------------------------------------

    it('handles file without trailing blank line', () => {
        const srt = [
            '1',
            '00:00:01,000 --> 00:00:04,000',
            'No trailing newline',
        ].join('\n');

        const result = parseSrt(srt);
        expect(result.totalEntries).toBe(1);
        expect(result.entries[0]!.plainText).toBe('No trailing newline');
    });

    // -----------------------------------------------------------------------
    // Windows line endings
    // -----------------------------------------------------------------------

    it('handles Windows CRLF line endings', () => {
        const srt = '1\r\n00:00:01,000 --> 00:00:04,000\r\nCRLF test\r\n';
        const result = parseSrt(srt);
        expect(result.totalEntries).toBe(1);
        expect(result.entries[0]!.plainText).toBe('CRLF test');
    });

    // -----------------------------------------------------------------------
    // Lenient parsing (missing index)
    // -----------------------------------------------------------------------

    it('infers missing index numbers with a warning', () => {
        const srt = [
            '00:00:01,000 --> 00:00:04,000',
            'Missing index',
            '',
        ].join('\n');

        const result = parseSrt(srt);
        expect(result.totalEntries).toBe(1);
        expect(result.entries[0]!.plainText).toBe('Missing index');
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('missing index');
    });

    // -----------------------------------------------------------------------
    // Validation: overlapping timecodes
    // -----------------------------------------------------------------------

    it('warns about overlapping timecodes', () => {
        const srt = [
            '1',
            '00:00:01,000 --> 00:00:05,000',
            'First',
            '',
            '2',
            '00:00:03,000 --> 00:00:07,000',
            'Overlapping',
            '',
        ].join('\n');

        const result = parseSrt(srt);
        expect(result.totalEntries).toBe(2);
        expect(result.warnings.some((w) => w.includes('overlaps'))).toBe(true);
    });

    // -----------------------------------------------------------------------
    // Validation: invalid timing skipped
    // -----------------------------------------------------------------------

    it('skips entries where end <= start by default', () => {
        const srt = [
            '1',
            '00:00:05,000 --> 00:00:03,000',
            'Bad timing',
            '',
            '2',
            '00:00:06,000 --> 00:00:09,000',
            'Good timing',
            '',
        ].join('\n');

        const result = parseSrt(srt);
        expect(result.totalEntries).toBe(1);
        expect(result.entries[0]!.plainText).toBe('Good timing');
        expect(result.warnings.some((w) => w.includes('skipped'))).toBe(true);
    });

    // -----------------------------------------------------------------------
    // Validation: duration warning
    // -----------------------------------------------------------------------

    it('warns when duration exceeds maximum', () => {
        const srt = [
            '1',
            '00:00:00,000 --> 01:00:01,000',
            'Over an hour',
            '',
        ].join('\n');

        const result = parseSrt(srt);
        expect(result.warnings.some((w) => w.includes('exceeds maximum'))).toBe(true);
    });

    // -----------------------------------------------------------------------
    // Error cases
    // -----------------------------------------------------------------------

    it('throws SrtParseError for empty input', () => {
        expect(() => parseSrt('')).toThrow(SrtParseError);
        expect(() => parseSrt('   ')).toThrow(SrtParseError);
        expect(() => parseSrt('\n\n')).toThrow(SrtParseError);
    });

    it('throws SrtParseError when no valid entries found', () => {
        const srt = 'garbage text\nmore garbage\n';
        expect(() => parseSrt(srt)).toThrow(SrtParseError);
    });

    it('thrown error has correct name', () => {
        try {
            parseSrt('');
        } catch (e) {
            expect(e).toBeInstanceOf(SrtParseError);
            expect((e as SrtParseError).name).toBe('SrtParseError');
        }
    });

    // -----------------------------------------------------------------------
    // Multiple entries
    // -----------------------------------------------------------------------

    it('parses a file with many entries in order', () => {
        const lines: string[] = [];
        for (let i = 1; i <= 10; i++) {
            const startSec = (i - 1) * 3;
            const endSec = i * 3;
            lines.push(
                `${i}`,
                `00:00:${String(startSec).padStart(2, '0')},000 --> 00:00:${String(endSec).padStart(2, '0')},000`,
                `Subtitle ${i}`,
                '',
            );
        }

        const result = parseSrt(lines.join('\n'));
        expect(result.totalEntries).toBe(10);
        expect(result.entries[0]!.plainText).toBe('Subtitle 1');
        expect(result.entries[9]!.plainText).toBe('Subtitle 10');
    });

    // -----------------------------------------------------------------------
    // Empty text entries stripped
    // -----------------------------------------------------------------------

    it('skips entries with empty text after HTML stripping', () => {
        const srt = [
            '1',
            '00:00:01,000 --> 00:00:04,000',
            '<b></b>',
            '',
            '2',
            '00:00:05,000 --> 00:00:08,000',
            'Valid text',
            '',
        ].join('\n');

        const result = parseSrt(srt);
        expect(result.totalEntries).toBe(1);
        expect(result.entries[0]!.plainText).toBe('Valid text');
    });

    // -----------------------------------------------------------------------
    // Extra blank lines between entries
    // -----------------------------------------------------------------------

    it('tolerates extra blank lines between entries', () => {
        const srt = [
            '',
            '',
            '1',
            '00:00:01,000 --> 00:00:04,000',
            'After blanks',
            '',
            '',
            '',
            '2',
            '00:00:05,000 --> 00:00:08,000',
            'After more blanks',
            '',
        ].join('\n');

        const result = parseSrt(srt);
        expect(result.totalEntries).toBe(2);
    });
});
