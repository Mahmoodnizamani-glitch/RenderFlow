/**
 * Preview bridge message types — Zod schemas for strictly typed
 * WebView ↔ React Native communication for the Remotion preview.
 *
 * PreviewMessage     = messages FROM the WebView TO React Native.
 * PreviewHostMessage = messages FROM React Native TO the WebView.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Preview resolution presets
// ---------------------------------------------------------------------------

export const PREVIEW_RESOLUTIONS = {
    '360p': { label: '360p', scale: 0.333 },
    '540p': { label: '540p', scale: 0.5 },
    '720p': { label: '720p', scale: 0.667 },
    '1080p': { label: '1080p', scale: 1.0 },
} as const;

export type PreviewResolutionKey = keyof typeof PREVIEW_RESOLUTIONS;

export const DEFAULT_PREVIEW_RESOLUTION: PreviewResolutionKey = '720p';

// ---------------------------------------------------------------------------
// Playback speed presets
// ---------------------------------------------------------------------------

export const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

// ---------------------------------------------------------------------------
// WebView → React Native messages
// ---------------------------------------------------------------------------

export const PreviewMessageSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('ready'),
        payload: z.object({}),
    }),
    z.object({
        type: z.literal('frame-update'),
        payload: z.object({
            frame: z.number().int().nonnegative(),
        }),
    }),
    z.object({
        type: z.literal('error'),
        payload: z.object({
            message: z.string(),
            stack: z.string().optional(),
        }),
    }),
    z.object({
        type: z.literal('playback-state'),
        payload: z.object({
            isPlaying: z.boolean(),
        }),
    }),
]);

export type PreviewMessage = z.infer<typeof PreviewMessageSchema>;

// ---------------------------------------------------------------------------
// React Native → WebView messages
// ---------------------------------------------------------------------------

export const PreviewHostMessageSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('load-code'),
        payload: z.object({
            code: z.string(),
            compositionWidth: z.number().int().positive(),
            compositionHeight: z.number().int().positive(),
            fps: z.number().int().positive(),
            durationInFrames: z.number().int().positive(),
        }),
    }),
    z.object({
        type: z.literal('play'),
        payload: z.object({}),
    }),
    z.object({
        type: z.literal('pause'),
        payload: z.object({}),
    }),
    z.object({
        type: z.literal('seek'),
        payload: z.object({
            frame: z.number().int().nonnegative(),
        }),
    }),
    z.object({
        type: z.literal('set-resolution'),
        payload: z.object({
            scale: z.number().positive(),
        }),
    }),
    z.object({
        type: z.literal('set-speed'),
        payload: z.object({
            rate: z.number().positive(),
        }),
    }),
    z.object({
        type: z.literal('toggle-loop'),
        payload: z.object({
            loop: z.boolean(),
        }),
    }),
    z.object({
        type: z.literal('update-variables'),
        payload: z.object({
            variables: z.record(z.unknown()),
        }),
    }),
]);

export type PreviewHostMessage = z.infer<typeof PreviewHostMessageSchema>;

// ---------------------------------------------------------------------------
// Helper to build host messages with type narrowing
// ---------------------------------------------------------------------------

export function createPreviewHostMessage<T extends PreviewHostMessage['type']>(
    type: T,
    payload: Extract<PreviewHostMessage, { type: T }>['payload'],
): string {
    return JSON.stringify({ type, payload });
}
