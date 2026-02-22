/**
 * Socket.io client for real-time render progress.
 *
 * Connects to the /renders namespace with JWT auth.
 * Auto-reconnects with exponential backoff and re-subscribes
 * to active job rooms on reconnect.
 */
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import Constants from 'expo-constants';
import { getAccessToken } from './secureStorage';

// ---------------------------------------------------------------------------
// Types — mirrors server ws/types.ts
// ---------------------------------------------------------------------------

export interface RenderStartedPayload {
    jobId: string;
    startedAt: string;
}

export interface RenderProgressPayload {
    jobId: string;
    currentFrame: number;
    totalFrames: number;
    percentage: number;
    stage: 'fetching' | 'preparing' | 'bundling' | 'rendering' | 'uploading';
    eta?: number | null;
}

export interface RenderCompletedPayload {
    jobId: string;
    outputUrl: string;
    fileSize: number;
    duration: number;
    completedAt: string;
}

export interface RenderFailedPayload {
    jobId: string;
    errorMessage: string;
    errorType: string;
    completedAt: string;
}

export interface RenderCancelledPayload {
    jobId: string;
}

export interface CreditsUpdatedPayload {
    balance: number;
}

interface ServerToClientEvents {
    'render:started': (payload: RenderStartedPayload) => void;
    'render:progress': (payload: RenderProgressPayload) => void;
    'render:completed': (payload: RenderCompletedPayload) => void;
    'render:failed': (payload: RenderFailedPayload) => void;
    'render:cancelled': (payload: RenderCancelledPayload) => void;
    'credits:updated': (payload: CreditsUpdatedPayload) => void;
}

interface ClientToServerEvents {
    'render:subscribe': (
        payload: { jobId: string },
        callback: (response: { ok: boolean; error?: string }) => void,
    ) => void;
    'render:unsubscribe': (
        payload: { jobId: string },
        callback: (response: { ok: boolean }) => void,
    ) => void;
}

type RenderSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type RenderEventHandler<T> = (payload: T) => void;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE_URL =
    Constants.expoConfig?.extra?.['apiUrl'] ??
    'http://localhost:3001';

const RECONNECT_DELAY_MS = 1_000;
const RECONNECT_DELAY_MAX_MS = 30_000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _socket: RenderSocket | null = null;
const _subscribedJobs = new Set<string>();

const _eventHandlers: {
    started: RenderEventHandler<RenderStartedPayload>[];
    progress: RenderEventHandler<RenderProgressPayload>[];
    completed: RenderEventHandler<RenderCompletedPayload>[];
    failed: RenderEventHandler<RenderFailedPayload>[];
    cancelled: RenderEventHandler<RenderCancelledPayload>[];
    creditsUpdated: RenderEventHandler<CreditsUpdatedPayload>[];
} = {
    started: [],
    progress: [],
    completed: [],
    failed: [],
    cancelled: [],
    creditsUpdated: [],
};

// ---------------------------------------------------------------------------
// Connection lifecycle
// ---------------------------------------------------------------------------

/**
 * Connect to the /renders WebSocket namespace.
 * No-op if already connected.
 */
export async function connect(): Promise<void> {
    if (_socket?.connected) return;

    const token = await getAccessToken();
    if (!token) return;

    _socket = io(`${API_BASE_URL}/renders`, {
        path: '/socket.io',
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: RECONNECT_DELAY_MS,
        reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
        reconnectionAttempts: Infinity,
        autoConnect: true,
    });

    registerEventListeners(_socket);
}

/**
 * Disconnect from the WebSocket server. Clears subscriptions.
 */
export function disconnect(): void {
    if (_socket) {
        _socket.removeAllListeners();
        _socket.disconnect();
        _socket = null;
    }
    _subscribedJobs.clear();
}

/**
 * Whether the socket is currently connected.
 */
export function isConnected(): boolean {
    return _socket?.connected ?? false;
}

/**
 * Update the auth token on the existing socket (e.g. after token refresh).
 * Forces a reconnect with the new token.
 */
export async function updateAuth(): Promise<void> {
    const token = await getAccessToken();
    if (!token || !_socket) return;

    _socket.auth = { token };
    _socket.disconnect().connect();
}

// ---------------------------------------------------------------------------
// Job subscription
// ---------------------------------------------------------------------------

/**
 * Subscribe to real-time updates for a specific render job.
 * Joins the `render:<jobId>` room on the server.
 */
export function subscribeToJob(jobId: string): void {
    _subscribedJobs.add(jobId);

    if (!_socket?.connected) return;

    _socket.emit('render:subscribe', { jobId }, (response) => {
        if (!response.ok) {
            console.warn(`[socket] Failed to subscribe to job ${jobId}:`, response.error);
            _subscribedJobs.delete(jobId);
        }
    });
}

/**
 * Unsubscribe from real-time updates for a specific render job.
 */
export function unsubscribeFromJob(jobId: string): void {
    _subscribedJobs.delete(jobId);

    if (!_socket?.connected) return;

    _socket.emit('render:unsubscribe', { jobId }, () => {
        // Fire and forget — no error handling needed
    });
}

/**
 * Get the set of currently subscribed job IDs.
 */
export function getSubscribedJobs(): ReadonlySet<string> {
    return _subscribedJobs;
}

// ---------------------------------------------------------------------------
// Event handler registration
// ---------------------------------------------------------------------------

export function onRenderStarted(handler: RenderEventHandler<RenderStartedPayload>): () => void {
    _eventHandlers.started.push(handler);
    return () => {
        _eventHandlers.started = _eventHandlers.started.filter((h) => h !== handler);
    };
}

export function onRenderProgress(handler: RenderEventHandler<RenderProgressPayload>): () => void {
    _eventHandlers.progress.push(handler);
    return () => {
        _eventHandlers.progress = _eventHandlers.progress.filter((h) => h !== handler);
    };
}

export function onRenderCompleted(handler: RenderEventHandler<RenderCompletedPayload>): () => void {
    _eventHandlers.completed.push(handler);
    return () => {
        _eventHandlers.completed = _eventHandlers.completed.filter((h) => h !== handler);
    };
}

export function onRenderFailed(handler: RenderEventHandler<RenderFailedPayload>): () => void {
    _eventHandlers.failed.push(handler);
    return () => {
        _eventHandlers.failed = _eventHandlers.failed.filter((h) => h !== handler);
    };
}

export function onRenderCancelled(handler: RenderEventHandler<RenderCancelledPayload>): () => void {
    _eventHandlers.cancelled.push(handler);
    return () => {
        _eventHandlers.cancelled = _eventHandlers.cancelled.filter((h) => h !== handler);
    };
}

export function onCreditsUpdated(handler: RenderEventHandler<CreditsUpdatedPayload>): () => void {
    _eventHandlers.creditsUpdated.push(handler);
    return () => {
        _eventHandlers.creditsUpdated = _eventHandlers.creditsUpdated.filter((h) => h !== handler);
    };
}

// ---------------------------------------------------------------------------
// Internal: wire socket events to handlers
// ---------------------------------------------------------------------------

function registerEventListeners(socket: RenderSocket): void {
    socket.on('render:started', (payload) => {
        for (const handler of _eventHandlers.started) handler(payload);
    });

    socket.on('render:progress', (payload) => {
        for (const handler of _eventHandlers.progress) handler(payload);
    });

    socket.on('render:completed', (payload) => {
        for (const handler of _eventHandlers.completed) handler(payload);
    });

    socket.on('render:failed', (payload) => {
        for (const handler of _eventHandlers.failed) handler(payload);
    });

    socket.on('render:cancelled', (payload) => {
        for (const handler of _eventHandlers.cancelled) handler(payload);
    });

    socket.on('credits:updated', (payload) => {
        for (const handler of _eventHandlers.creditsUpdated) handler(payload);
    });

    // Re-subscribe to all active jobs on reconnect
    socket.on('connect', () => {
        for (const jobId of _subscribedJobs) {
            socket.emit('render:subscribe', { jobId }, (response) => {
                if (!response.ok) {
                    console.warn(`[socket] Re-subscribe failed for job ${jobId}:`, response.error);
                }
            });
        }
    });
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Reset all state. **Test-only.**
 */
export function _resetForTests(): void {
    disconnect();
    _eventHandlers.started = [];
    _eventHandlers.progress = [];
    _eventHandlers.completed = [];
    _eventHandlers.failed = [];
    _eventHandlers.cancelled = [];
    _eventHandlers.creditsUpdated = [];
}
