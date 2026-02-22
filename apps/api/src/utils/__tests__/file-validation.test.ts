/**
 * File validation unit tests.
 *
 * Tests magic-byte detection for all supported file types.
 */
import { describe, it, expect } from 'vitest';

import { detectFileType, validateFile, MAX_FILE_SIZE } from '../file-validation.js';

// ---------------------------------------------------------------------------
// Helpers — create buffers with correct magic bytes
// ---------------------------------------------------------------------------

function makeBuffer(bytes: number[], padTo = 16): Uint8Array {
    const buf = new Uint8Array(padTo);
    for (let i = 0; i < bytes.length; i++) {
        buf[i] = bytes[i]!;
    }
    return buf;
}

// ---------------------------------------------------------------------------
// Image detection
// ---------------------------------------------------------------------------

describe('detectFileType — images', () => {
    it('detects JPEG', () => {
        const buf = makeBuffer([0xFF, 0xD8, 0xFF, 0xE0]);
        const result = detectFileType(buf);
        expect(result).toEqual({ mime: 'image/jpeg', type: 'image', ext: 'jpg' });
    });

    it('detects PNG', () => {
        const buf = makeBuffer([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        const result = detectFileType(buf);
        expect(result).toEqual({ mime: 'image/png', type: 'image', ext: 'png' });
    });

    it('detects GIF', () => {
        const buf = makeBuffer([0x47, 0x49, 0x46, 0x38]);
        const result = detectFileType(buf);
        expect(result).toEqual({ mime: 'image/gif', type: 'image', ext: 'gif' });
    });

    it('detects WebP (RIFF + WEBP)', () => {
        // RIFF....WEBP
        const bytes = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
        const buf = makeBuffer(bytes, 16);
        const result = detectFileType(buf);
        expect(result).toEqual({ mime: 'image/webp', type: 'image', ext: 'webp' });
    });

    it('detects SVG', () => {
        const svgString = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg">';
        const buf = new TextEncoder().encode(svgString);
        const result = detectFileType(buf);
        expect(result).toEqual({ mime: 'image/svg+xml', type: 'image', ext: 'svg' });
    });
});

// ---------------------------------------------------------------------------
// Video detection
// ---------------------------------------------------------------------------

describe('detectFileType — video', () => {
    it('detects MP4 (ftyp at offset 4)', () => {
        const bytes = [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70];
        const buf = makeBuffer(bytes, 16);
        const result = detectFileType(buf);
        expect(result).toEqual({ mime: 'video/mp4', type: 'video', ext: 'mp4' });
    });

    it('detects WebM (EBML header)', () => {
        const buf = makeBuffer([0x1A, 0x45, 0xDF, 0xA3]);
        const result = detectFileType(buf);
        expect(result).toEqual({ mime: 'video/webm', type: 'video', ext: 'webm' });
    });
});

// ---------------------------------------------------------------------------
// Audio detection
// ---------------------------------------------------------------------------

describe('detectFileType — audio', () => {
    it('detects MP3 (ID3 tag)', () => {
        const buf = makeBuffer([0x49, 0x44, 0x33]);
        const result = detectFileType(buf);
        expect(result).toEqual({ mime: 'audio/mpeg', type: 'audio', ext: 'mp3' });
    });

    it('detects MP3 (MPEG sync)', () => {
        const buf = makeBuffer([0xFF, 0xFB, 0x90, 0x00]);
        const result = detectFileType(buf);
        expect(result).toEqual({ mime: 'audio/mpeg', type: 'audio', ext: 'mp3' });
    });

    it('detects WAV (RIFF + WAVE)', () => {
        const bytes = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45];
        const buf = makeBuffer(bytes, 16);
        const result = detectFileType(buf);
        expect(result).toEqual({ mime: 'audio/wav', type: 'audio', ext: 'wav' });
    });

    it('detects OGG', () => {
        const buf = makeBuffer([0x4F, 0x67, 0x67, 0x53]);
        const result = detectFileType(buf);
        expect(result).toEqual({ mime: 'audio/ogg', type: 'audio', ext: 'ogg' });
    });
});

// ---------------------------------------------------------------------------
// Font detection
// ---------------------------------------------------------------------------

describe('detectFileType — fonts', () => {
    it('detects TTF', () => {
        const buf = makeBuffer([0x00, 0x01, 0x00, 0x00, 0x00]);
        const result = detectFileType(buf);
        expect(result).toEqual({ mime: 'font/ttf', type: 'font', ext: 'ttf' });
    });

    it('detects OTF (OTTO)', () => {
        const buf = makeBuffer([0x4F, 0x54, 0x54, 0x4F]);
        const result = detectFileType(buf);
        expect(result).toEqual({ mime: 'font/otf', type: 'font', ext: 'otf' });
    });

    it('detects WOFF', () => {
        const buf = makeBuffer([0x77, 0x4F, 0x46, 0x46]);
        const result = detectFileType(buf);
        expect(result).toEqual({ mime: 'font/woff', type: 'font', ext: 'woff' });
    });

    it('detects WOFF2', () => {
        const buf = makeBuffer([0x77, 0x4F, 0x46, 0x32]);
        const result = detectFileType(buf);
        expect(result).toEqual({ mime: 'font/woff2', type: 'font', ext: 'woff2' });
    });
});

// ---------------------------------------------------------------------------
// Edge cases & rejection
// ---------------------------------------------------------------------------

describe('detectFileType — edge cases', () => {
    it('returns null for unsupported file type', () => {
        const _buf = makeBuffer([0x00, 0x00, 0x00, 0x00]);
        // All zeros might match TTF signature (00 01 00 00)
        // but 4 zeros != that pattern, so should be null or fallback
        const buf2 = makeBuffer([0xDE, 0xAD, 0xBE, 0xEF]);
        const result = detectFileType(buf2);
        expect(result).toBeNull();
    });

    it('returns null for empty buffer', () => {
        const buf = new Uint8Array(0);
        const result = detectFileType(buf);
        expect(result).toBeNull();
    });

    it('returns null for very short buffer', () => {
        const buf = new Uint8Array([0x89]);
        const result = detectFileType(buf);
        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// validateFile
// ---------------------------------------------------------------------------

describe('validateFile', () => {
    it('validates a valid PNG', () => {
        const buf = makeBuffer([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 100);
        const result = validateFile(buf, 'test.png');
        expect(result.mime).toBe('image/png');
        expect(result.type).toBe('image');
    });

    it('throws on empty file', () => {
        const buf = new Uint8Array(0);
        expect(() => validateFile(buf, 'empty.txt')).toThrow('empty');
    });

    it('throws on unsupported file type', () => {
        const buf = makeBuffer([0xDE, 0xAD, 0xBE, 0xEF], 100);
        expect(() => validateFile(buf, 'evil.exe')).toThrow('unsupported');
    });

    it('throws on file exceeding 50MB', () => {
        const buf = new Uint8Array(MAX_FILE_SIZE + 1);
        // Put valid PNG header
        buf.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        expect(() => validateFile(buf, 'huge.png')).toThrow('50MB');
    });
});
