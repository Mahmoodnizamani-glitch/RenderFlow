/**
 * WebSocket event type definitions and Zod validation schemas.
 *
 * Defines the strongly-typed event protocol between Socket.io
 * clients and the server's /renders namespace.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Client → Server events
// ---------------------------------------------------------------------------

export const RenderSubscribeSchema = z.object({
    jobId: z.string().uuid(),
});

export const RenderUnsubscribeSchema = z.object({
    jobId: z.string().uuid(),
});

export type RenderSubscribePayload = z.infer<typeof RenderSubscribeSchema>;
export type RenderUnsubscribePayload = z.infer<typeof RenderUnsubscribeSchema>;

// ---------------------------------------------------------------------------
// Server → Client events
// ---------------------------------------------------------------------------

export const RenderStartedSchema = z.object({
    jobId: z.string().uuid(),
    startedAt: z.string().datetime(),
});

export const RenderProgressSchema = z.object({
    jobId: z.string().uuid(),
    currentFrame: z.number().int().min(0),
    totalFrames: z.number().int().min(0),
    percentage: z.number().min(0).max(100),
    stage: z.enum(['fetching', 'preparing', 'bundling', 'rendering', 'uploading']),
    eta: z.number().nullable().optional(),
});

export const RenderCompletedSchema = z.object({
    jobId: z.string().uuid(),
    outputUrl: z.string().url(),
    fileSize: z.number().int().positive(),
    duration: z.number().int().positive(),
    completedAt: z.string().datetime(),
});

export const RenderFailedSchema = z.object({
    jobId: z.string().uuid(),
    errorMessage: z.string(),
    errorType: z.string(),
    completedAt: z.string().datetime(),
});

export const RenderCancelledSchema = z.object({
    jobId: z.string().uuid(),
});

export const CreditsUpdatedSchema = z.object({
    balance: z.number().int().min(0),
});

export const NotificationSchema = z.object({
    type: z.enum(['info', 'success', 'warning', 'error']),
    title: z.string(),
    message: z.string(),
    timestamp: z.string().datetime(),
});

export type RenderStartedPayload = z.infer<typeof RenderStartedSchema>;
export type RenderProgressPayload = z.infer<typeof RenderProgressSchema>;
export type RenderCompletedPayload = z.infer<typeof RenderCompletedSchema>;
export type RenderFailedPayload = z.infer<typeof RenderFailedSchema>;
export type RenderCancelledPayload = z.infer<typeof RenderCancelledSchema>;
export type CreditsUpdatedPayload = z.infer<typeof CreditsUpdatedSchema>;
export type NotificationPayload = z.infer<typeof NotificationSchema>;

// ---------------------------------------------------------------------------
// Socket.io typed interfaces
// ---------------------------------------------------------------------------

export interface ClientToServerEvents {
    'render:subscribe': (
        payload: RenderSubscribePayload,
        callback: (response: { ok: boolean; error?: string }) => void,
    ) => void;
    'render:unsubscribe': (
        payload: RenderUnsubscribePayload,
        callback: (response: { ok: boolean }) => void,
    ) => void;
}

export interface ServerToClientEvents {
    'render:started': (payload: RenderStartedPayload) => void;
    'render:progress': (payload: RenderProgressPayload) => void;
    'render:completed': (payload: RenderCompletedPayload) => void;
    'render:failed': (payload: RenderFailedPayload) => void;
    'render:cancelled': (payload: RenderCancelledPayload) => void;
    'credits:updated': (payload: CreditsUpdatedPayload) => void;
    'notification': (payload: NotificationPayload) => void;
}

export interface InterServerEvents {
    ping: () => void;
}

export interface SocketData {
    userId: string;
}
