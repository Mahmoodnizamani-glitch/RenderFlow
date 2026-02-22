/**
 * File type validation via magic bytes.
 *
 * Inspects the first bytes of a buffer to determine the real file type,
 * regardless of the file extension. Prevents uploading malicious files
 * with a renamed extension.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetectedFileType {
    /** MIME type, e.g. "image/png" */
    mime: string;
    /** Asset category: image | video | audio | font */
    type: 'image' | 'video' | 'audio' | 'font';
    /** Canonical file extension */
    ext: string;
}

// ---------------------------------------------------------------------------
// Magic byte signatures
// ---------------------------------------------------------------------------

interface MagicSignature {
    bytes: number[];
    offset: number;
    mime: string;
    type: DetectedFileType['type'];
    ext: string;
}

const SIGNATURES: MagicSignature[] = [
    // Images
    { bytes: [0xFF, 0xD8, 0xFF], offset: 0, mime: 'image/jpeg', type: 'image', ext: 'jpg' },
    { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0, mime: 'image/png', type: 'image', ext: 'png' },
    { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0, mime: 'image/gif', type: 'image', ext: 'gif' },
    // WebP: RIFF + 4-byte size + WEBP
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mime: 'image/webp', type: 'image', ext: 'webp' },
    // SVG — text-based, detect via opening tag
    // (handled separately below)

    // Video
    // MP4: ftyp box (offset 4)
    { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4, mime: 'video/mp4', type: 'video', ext: 'mp4' },
    // WebM: EBML header
    { bytes: [0x1A, 0x45, 0xDF, 0xA3], offset: 0, mime: 'video/webm', type: 'video', ext: 'webm' },

    // Audio
    // MP3: ID3 tag or MPEG sync
    { bytes: [0x49, 0x44, 0x33], offset: 0, mime: 'audio/mpeg', type: 'audio', ext: 'mp3' },
    { bytes: [0xFF, 0xFB], offset: 0, mime: 'audio/mpeg', type: 'audio', ext: 'mp3' },
    // WAV: RIFF + WAVE
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mime: 'audio/wav', type: 'audio', ext: 'wav' },
    // OGG
    { bytes: [0x4F, 0x67, 0x67, 0x53], offset: 0, mime: 'audio/ogg', type: 'audio', ext: 'ogg' },

    // Fonts
    // TTF
    { bytes: [0x00, 0x01, 0x00, 0x00], offset: 0, mime: 'font/ttf', type: 'font', ext: 'ttf' },
    // OTF: OTTO
    { bytes: [0x4F, 0x54, 0x54, 0x4F], offset: 0, mime: 'font/otf', type: 'font', ext: 'otf' },
    // WOFF
    { bytes: [0x77, 0x4F, 0x46, 0x46], offset: 0, mime: 'font/woff', type: 'font', ext: 'woff' },
    // WOFF2
    { bytes: [0x77, 0x4F, 0x46, 0x32], offset: 0, mime: 'font/woff2', type: 'font', ext: 'woff2' },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum upload size in bytes: 50 MB */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Disambiguate RIFF-based formats (WebP vs WAV).
 */
function disambiguateRiff(buffer: Uint8Array): DetectedFileType | null {
    // RIFF at offset 0, then 4 bytes size, then format identifier at offset 8
    if (buffer.length < 12) return null;

    const format = String.fromCharCode(buffer[8]!, buffer[9]!, buffer[10]!, buffer[11]!);

    if (format === 'WEBP') {
        return { mime: 'image/webp', type: 'image', ext: 'webp' };
    }
    if (format === 'WAVE') {
        return { mime: 'audio/wav', type: 'audio', ext: 'wav' };
    }

    return null;
}

/**
 * Detect if the buffer is SVG (XML-based).
 */
function detectSvg(buffer: Uint8Array): DetectedFileType | null {
    // Check first 256 bytes for <svg tag
    const head = new TextDecoder('utf-8', { fatal: false })
        .decode(buffer.subarray(0, Math.min(buffer.length, 256)))
        .toLowerCase();

    if (head.includes('<svg')) {
        return { mime: 'image/svg+xml', type: 'image', ext: 'svg' };
    }

    return null;
}

/**
 * Detect the file type from a buffer's magic bytes.
 * Returns `null` if the file type is not in the allowed list.
 */
export function detectFileType(buffer: Uint8Array): DetectedFileType | null {
    if (buffer.length < 4) return null;

    for (const sig of SIGNATURES) {
        if (buffer.length < sig.offset + sig.bytes.length) continue;

        let match = true;
        for (let i = 0; i < sig.bytes.length; i++) {
            if (buffer[sig.offset + i] !== sig.bytes[i]) {
                match = false;
                break;
            }
        }

        if (match) {
            // RIFF is ambiguous — WebP or WAV
            if (sig.bytes[0] === 0x52 && sig.bytes[1] === 0x49) {
                const riffResult = disambiguateRiff(buffer);
                if (riffResult) return riffResult;
                continue;
            }

            return { mime: sig.mime, type: sig.type, ext: sig.ext };
        }
    }

    // Try SVG (text-based)
    return detectSvg(buffer);
}

/**
 * Validate that a buffer represents an allowed file type and is within size limits.
 */
export function validateFile(
    buffer: Uint8Array,
    filename: string,
): DetectedFileType {
    if (buffer.length > MAX_FILE_SIZE) {
        throw new Error(`File "${filename}" exceeds the 50MB size limit`);
    }

    if (buffer.length === 0) {
        throw new Error(`File "${filename}" is empty`);
    }

    const detected = detectFileType(buffer);
    if (!detected) {
        throw new Error(
            `File "${filename}" has an unsupported file type. ` +
            'Allowed: JPEG, PNG, GIF, WebP, SVG, MP4, WebM, MP3, WAV, OGG, TTF, OTF, WOFF, WOFF2',
        );
    }

    return detected;
}
