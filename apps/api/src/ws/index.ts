/**
 * WebSocket module barrel export.
 */

// Server lifecycle
export { initWebSocket, getIO, closeWebSocket, resetWebSocket } from './server.js';
export type { TypedSocketServer, WebSocketConfig } from './server.js';

// Emitter (used by services to push events)
export {
    emitRenderStarted,
    emitRenderProgress,
    emitRenderCompleted,
    emitRenderFailed,
    emitRenderCancelled,
    emitCreditsUpdated,
    emitNotification,
    resetProgressThrottles,
} from './emitter.js';

// Handlers
export { setJobOwnershipChecker } from './handlers.js';
export type { JobOwnershipChecker } from './handlers.js';

// Notifications
export { setNotificationRedis } from './notifications.js';

// Types (re-export for consumers)
export type {
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData,
    RenderStartedPayload,
    RenderProgressPayload,
    RenderCompletedPayload,
    RenderFailedPayload,
    RenderCancelledPayload,
    CreditsUpdatedPayload,
    NotificationPayload,
} from './types.js';
