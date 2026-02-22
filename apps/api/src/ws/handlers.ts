/**
 * Per-connection Socket.io event handlers.
 *
 * Handles the connection lifecycle:
 *   - On connect: join user room, deliver pending notifications
 *   - render:subscribe: validate job ownership, join job room
 *   - render:unsubscribe: leave job room
 *   - On disconnect: automatic cleanup by Socket.io
 */
import type { Socket } from 'socket.io';

import type {
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData,
} from './types.js';
import { RenderSubscribeSchema, RenderUnsubscribeSchema } from './types.js';
import { deliverPendingNotifications } from './notifications.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthenticatedSocket = Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>;

/**
 * Function to verify job ownership. Injected to keep this module
 * decoupled from the database layer.
 */
export type JobOwnershipChecker = (
    jobId: string,
    userId: string,
) => Promise<boolean>;

// ---------------------------------------------------------------------------
// Singleton ownership checker
// ---------------------------------------------------------------------------

let _checkJobOwnership: JobOwnershipChecker = async () => false;

/**
 * Register the job ownership checker function.
 * Called once during server initialisation to inject the DB-backed implementation.
 */
export function setJobOwnershipChecker(checker: JobOwnershipChecker): void {
    _checkJobOwnership = checker;
}

// ---------------------------------------------------------------------------
// Handler registration
// ---------------------------------------------------------------------------

/**
 * Register event handlers on a newly connected socket.
 * Called for each connection to the /renders namespace.
 */
export function registerHandlers(socket: AuthenticatedSocket): void {
    const userId = socket.data.userId;

    if (!userId) {
        socket.disconnect(true);
        return;
    }

    // Join the user-specific room for targeted broadcasts
    void socket.join(`user:${userId}`);

    // Deliver any notifications queued while the user was offline
    void deliverPendingNotifications(socket, userId);

    // ----- render:subscribe ------------------------------------------------

    socket.on('render:subscribe', async (payload, callback) => {
        const parsed = RenderSubscribeSchema.safeParse(payload);

        if (!parsed.success) {
            callback({ ok: false, error: 'Invalid payload' });
            return;
        }

        const { jobId } = parsed.data;

        // Security: verify the job belongs to this user
        const isOwner = await _checkJobOwnership(jobId, userId);
        if (!isOwner) {
            callback({ ok: false, error: 'Job not found or access denied' });
            return;
        }

        void socket.join(`render:${jobId}`);
        callback({ ok: true });
    });

    // ----- render:unsubscribe ----------------------------------------------

    socket.on('render:unsubscribe', (payload, callback) => {
        const parsed = RenderUnsubscribeSchema.safeParse(payload);

        if (!parsed.success) {
            callback({ ok: false });
            return;
        }

        void socket.leave(`render:${parsed.data.jobId}`);
        callback({ ok: true });
    });
}
