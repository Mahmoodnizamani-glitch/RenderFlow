/**
 * previewBridge tests — validates Zod schemas and helper functions
 * for the preview WebView ↔ React Native message protocol.
 */
import {
    PreviewMessageSchema,
    PreviewHostMessageSchema,
    createPreviewHostMessage,
    PREVIEW_RESOLUTIONS,
    PLAYBACK_SPEEDS,
    DEFAULT_PREVIEW_RESOLUTION,
} from '../previewBridge';

describe('previewBridge', () => {
    // -----------------------------------------------------------------
    // PreviewMessageSchema (WebView → RN)
    // -----------------------------------------------------------------

    describe('PreviewMessageSchema', () => {
        it('parses a valid ready message', () => {
            const result = PreviewMessageSchema.safeParse({
                type: 'ready',
                payload: {},
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('ready');
            }
        });

        it('parses a valid frame-update message', () => {
            const result = PreviewMessageSchema.safeParse({
                type: 'frame-update',
                payload: { frame: 42 },
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('frame-update');
                expect(result.data.payload).toEqual({ frame: 42 });
            }
        });

        it('parses a valid error message', () => {
            const result = PreviewMessageSchema.safeParse({
                type: 'error',
                payload: { message: 'SyntaxError', stack: 'at line 1' },
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('error');
                expect((result.data.payload as { message: string }).message).toBe('SyntaxError');
            }
        });

        it('parses error message without optional stack', () => {
            const result = PreviewMessageSchema.safeParse({
                type: 'error',
                payload: { message: 'Something broke' },
            });
            expect(result.success).toBe(true);
        });

        it('parses a valid playback-state message', () => {
            const result = PreviewMessageSchema.safeParse({
                type: 'playback-state',
                payload: { isPlaying: true },
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.payload).toEqual({ isPlaying: true });
            }
        });

        it('rejects unknown message type', () => {
            const result = PreviewMessageSchema.safeParse({
                type: 'unknown',
                payload: {},
            });
            expect(result.success).toBe(false);
        });

        it('rejects message missing payload', () => {
            const result = PreviewMessageSchema.safeParse({
                type: 'ready',
            });
            expect(result.success).toBe(false);
        });

        it('rejects frame-update with negative frame', () => {
            const result = PreviewMessageSchema.safeParse({
                type: 'frame-update',
                payload: { frame: -1 },
            });
            expect(result.success).toBe(false);
        });
    });

    // -----------------------------------------------------------------
    // PreviewHostMessageSchema (RN → WebView)
    // -----------------------------------------------------------------

    describe('PreviewHostMessageSchema', () => {
        it('parses a valid load-code message', () => {
            const result = PreviewHostMessageSchema.safeParse({
                type: 'load-code',
                payload: {
                    code: 'const x = 1;',
                    compositionWidth: 1920,
                    compositionHeight: 1080,
                    fps: 30,
                    durationInFrames: 150,
                },
            });
            expect(result.success).toBe(true);
        });

        it('parses a valid play message', () => {
            const result = PreviewHostMessageSchema.safeParse({
                type: 'play',
                payload: {},
            });
            expect(result.success).toBe(true);
        });

        it('parses a valid pause message', () => {
            const result = PreviewHostMessageSchema.safeParse({
                type: 'pause',
                payload: {},
            });
            expect(result.success).toBe(true);
        });

        it('parses a valid seek message', () => {
            const result = PreviewHostMessageSchema.safeParse({
                type: 'seek',
                payload: { frame: 100 },
            });
            expect(result.success).toBe(true);
        });

        it('parses a valid set-resolution message', () => {
            const result = PreviewHostMessageSchema.safeParse({
                type: 'set-resolution',
                payload: { scale: 0.667 },
            });
            expect(result.success).toBe(true);
        });

        it('parses a valid set-speed message', () => {
            const result = PreviewHostMessageSchema.safeParse({
                type: 'set-speed',
                payload: { rate: 2 },
            });
            expect(result.success).toBe(true);
        });

        it('parses a valid toggle-loop message', () => {
            const result = PreviewHostMessageSchema.safeParse({
                type: 'toggle-loop',
                payload: { loop: false },
            });
            expect(result.success).toBe(true);
        });

        it('rejects load-code with missing composition fields', () => {
            const result = PreviewHostMessageSchema.safeParse({
                type: 'load-code',
                payload: { code: 'const x = 1;' },
            });
            expect(result.success).toBe(false);
        });

        it('rejects set-speed with zero rate', () => {
            const result = PreviewHostMessageSchema.safeParse({
                type: 'set-speed',
                payload: { rate: 0 },
            });
            expect(result.success).toBe(false);
        });
    });

    // -----------------------------------------------------------------
    // createPreviewHostMessage
    // -----------------------------------------------------------------

    describe('createPreviewHostMessage', () => {
        it('serializes a play message to JSON', () => {
            const json = createPreviewHostMessage('play', {});
            const parsed = JSON.parse(json);
            expect(parsed).toEqual({ type: 'play', payload: {} });
        });

        it('serializes a load-code message with full payload', () => {
            const json = createPreviewHostMessage('load-code', {
                code: 'function App() {}',
                compositionWidth: 1280,
                compositionHeight: 720,
                fps: 60,
                durationInFrames: 300,
            });
            const parsed = JSON.parse(json);
            expect(parsed.type).toBe('load-code');
            expect(parsed.payload.code).toBe('function App() {}');
            expect(parsed.payload.fps).toBe(60);
        });

        it('serializes a seek message', () => {
            const json = createPreviewHostMessage('seek', { frame: 75 });
            const parsed = JSON.parse(json);
            expect(parsed).toEqual({ type: 'seek', payload: { frame: 75 } });
        });
    });

    // -----------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------

    describe('constants', () => {
        it('has preview resolution presets with valid scale values', () => {
            expect(PREVIEW_RESOLUTIONS['360p'].scale).toBeGreaterThan(0);
            expect(PREVIEW_RESOLUTIONS['360p'].scale).toBeLessThan(1);
            expect(PREVIEW_RESOLUTIONS['1080p'].scale).toBe(1.0);
        });

        it('has playback speed presets', () => {
            expect(PLAYBACK_SPEEDS).toEqual([0.5, 1, 1.5, 2]);
        });

        it('has a valid default resolution', () => {
            expect(DEFAULT_PREVIEW_RESOLUTION).toBe('720p');
            expect(PREVIEW_RESOLUTIONS[DEFAULT_PREVIEW_RESOLUTION]).toBeDefined();
        });
    });
});
