/**
 * Server-side event emitter for Socket.io.
 *
 * Provides typed helper functions that services call to push
 * real-time events to connected clients. Events are routed to
 * the correct user/job rooms.
 *
 * Progress events are rate-limited to max 2 per second per job
 * to prevent flooding connected clients.
 */
import { getIO } from './server.js';
import type {
    RenderStartedPayload,
    RenderProgressPayload,
    RenderCompletedPayload,
    RenderFailedPayload,
    RenderCancelledPayload,
    CreditsUpdatedPayload,
    NotificationPayload,
} from './types.js';
import { queueNotification } from './notifications.js';

// ---------------------------------------------------------------------------
// Progress rate limiter
// ---------------------------------------------------------------------------

const MIN_PROGRESS_INTERVAL_MS = 500; // max 2 per second per job
const _lastProgressTime = new Map<string, number>();

function shouldThrottleProgress(jobId: string): boolean {
    const now = Date.now();
    const lastTime = _lastProgressTime.get(jobId);

    if (lastTime && now - lastTime < MIN_PROGRESS_INTERVAL_MS) {
        return true;
    }

    _lastProgressTime.set(jobId, now);
    return false;
}

/**
 * Clean up rate-limit tracking for a completed/failed job.
 */
function clearProgressThrottle(jobId: string): void {
    _lastProgressTime.delete(jobId);
}

// ---------------------------------------------------------------------------
// Emit helpers
// ---------------------------------------------------------------------------

/**
 * Emit 'render:started' to the user room and the job room.
 */
export function emitRenderStarted(
    userId: string,
    jobId: string,
    data: Omit<RenderStartedPayload, 'jobId'>,
): void {
    const io = getIO();
    if (!io) return;

    const payload: RenderStartedPayload = { jobId, ...data };
    const nsp = io.of('/renders');

    nsp.to(`user:${userId}`).emit('render:started', payload);
    nsp.to(`render:${jobId}`).emit('render:started', payload);
}

/**
 * Emit 'render:progress' to the user room and the job room.
 * Rate-limited to max 2 events per second per job.
 */
export function emitRenderProgress(
    userId: string,
    jobId: string,
    data: Omit<RenderProgressPayload, 'jobId'>,
): void {
    if (shouldThrottleProgress(jobId)) return;

    const io = getIO();
    if (!io) return;

    const payload: RenderProgressPayload = { jobId, ...data };
    const nsp = io.of('/renders');

    nsp.to(`user:${userId}`).emit('render:progress', payload);
    nsp.to(`render:${jobId}`).emit('render:progress', payload);
}

/**
 * Emit 'render:completed' to the user room and the job room.
 */
export function emitRenderCompleted(
    userId: string,
    jobId: string,
    data: Omit<RenderCompletedPayload, 'jobId'>,
): void {
    clearProgressThrottle(jobId);

    const io = getIO();
    if (!io) return;

    const payload: RenderCompletedPayload = { jobId, ...data };
    const nsp = io.of('/renders');

    nsp.to(`user:${userId}`).emit('render:completed', payload);
    nsp.to(`render:${jobId}`).emit('render:completed', payload);
}

/**
 * Emit 'render:failed' to the user room and the job room.
 */
export function emitRenderFailed(
    userId: string,
    jobId: string,
    data: Omit<RenderFailedPayload, 'jobId'>,
): void {
    clearProgressThrottle(jobId);

    const io = getIO();
    if (!io) return;

    const payload: RenderFailedPayload = { jobId, ...data };
    const nsp = io.of('/renders');

    nsp.to(`user:${userId}`).emit('render:failed', payload);
    nsp.to(`render:${jobId}`).emit('render:failed', payload);
}

/**
 * Emit 'render:cancelled' to the user room and the job room.
 */
export function emitRenderCancelled(userId: string, jobId: string): void {
    clearProgressThrottle(jobId);

    const io = getIO();
    if (!io) return;

    const payload: RenderCancelledPayload = { jobId };
    const nsp = io.of('/renders');

    nsp.to(`user:${userId}`).emit('render:cancelled', payload);
    nsp.to(`render:${jobId}`).emit('render:cancelled', payload);
}

/**
 * Emit 'credits:updated' to the user room.
 */
export function emitCreditsUpdated(userId: string, balance: number): void {
    const io = getIO();
    if (!io) return;

    const payload: CreditsUpdatedPayload = { balance };
    io.of('/renders').to(`user:${userId}`).emit('credits:updated', payload);
}

/**
 * Emit 'notification' to the user room.
 * If no sockets are connected for the user, queues the notification
 * in Redis for delivery on next connection.
 */
export async function emitNotification(
    userId: string,
    notification: NotificationPayload,
): Promise<void> {
    const io = getIO();
    if (!io) return;

    const nsp = io.of('/renders');
    const sockets = await nsp.in(`user:${userId}`).fetchSockets();

    if (sockets.length > 0) {
        nsp.to(`user:${userId}`).emit('notification', notification);
    } else {
        // User is offline — queue for delivery on reconnect
        await queueNotification(userId, notification);
    }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Clear the progress rate-limiter map. **Test-only.**
 */
export function resetProgressThrottles(): void {
    _lastProgressTime.clear();
}
