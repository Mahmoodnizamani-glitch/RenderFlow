/**
 * Editor bridge message types — Zod schemas for strictly typed
 * WebView ↔ React Native communication.
 *
 * EditorMessage = messages FROM the WebView TO React Native.
 * HostMessage    = messages FROM React Native TO the WebView.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Editor → React Native messages
// ---------------------------------------------------------------------------

export const EditorMarkerSchema = z.object({
    message: z.string(),
    severity: z.enum(['error', 'warning']),
    startLine: z.number().int().positive(),
    startColumn: z.number().int().positive(),
    endLine: z.number().int().positive(),
    endColumn: z.number().int().positive(),
});

export type EditorMarker = z.infer<typeof EditorMarkerSchema>;

export const EditorMessageSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('code-change'),
        payload: z.object({ code: z.string() }),
    }),
    z.object({
        type: z.literal('error'),
        payload: z.object({ markers: z.array(EditorMarkerSchema) }),
    }),
    z.object({
        type: z.literal('ready'),
        payload: z.object({}),
    }),
    z.object({
        type: z.literal('cursor'),
        payload: z.object({
            line: z.number().int().positive(),
            column: z.number().int().positive(),
        }),
    }),
]);

export type EditorMessage = z.infer<typeof EditorMessageSchema>;

// ---------------------------------------------------------------------------
// React Native → Editor messages
// ---------------------------------------------------------------------------

export const HostMessageSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('set-code'),
        payload: z.object({ code: z.string() }),
    }),
    z.object({
        type: z.literal('get-code'),
        payload: z.object({}),
    }),
    z.object({
        type: z.literal('format'),
        payload: z.object({}),
    }),
    z.object({
        type: z.literal('undo'),
        payload: z.object({}),
    }),
    z.object({
        type: z.literal('redo'),
        payload: z.object({}),
    }),
    z.object({
        type: z.literal('set-theme'),
        payload: z.object({ theme: z.enum(['vs-dark', 'vs']) }),
    }),
    z.object({
        type: z.literal('set-font-size'),
        payload: z.object({ size: z.number().int().positive() }),
    }),
    z.object({
        type: z.literal('set-word-wrap'),
        payload: z.object({ enabled: z.boolean() }),
    }),
    z.object({
        type: z.literal('set-line-numbers'),
        payload: z.object({ enabled: z.boolean() }),
    }),
    z.object({
        type: z.literal('set-readonly'),
        payload: z.object({ readOnly: z.boolean() }),
    }),
    z.object({
        type: z.literal('reveal-line'),
        payload: z.object({ line: z.number().int().positive() }),
    }),
]);

export type HostMessage = z.infer<typeof HostMessageSchema>;

// ---------------------------------------------------------------------------
// Helper to build host messages with type narrowing
// ---------------------------------------------------------------------------

export function createHostMessage<T extends HostMessage['type']>(
    type: T,
    payload: Extract<HostMessage, { type: T }>['payload'],
): string {
    return JSON.stringify({ type, payload });
}
