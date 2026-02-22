/**
 * Socket.io server factory.
 *
 * Creates and configures the Socket.io server, mounts it on
 * Fastify's underlying HTTP server, and sets up the /renders
 * namespace with authentication and event handlers.
 */
import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';

import type {
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData,
} from './types.js';
import { createAuthMiddleware } from './auth.js';
import { registerHandlers } from './handlers.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TypedSocketServer = SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>;

export interface WebSocketConfig {
    jwtSecret: string;
    corsOrigin: string;
    redisUrl?: string;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _io: TypedSocketServer | null = null;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Initialise the Socket.io server on the given HTTP server.
 *
 * - Namespace: /renders
 * - Heartbeat: 30s ping, 60s timeout
 * - CORS aligned with Fastify config
 */
export function initWebSocket(
    httpServer: HttpServer,
    config: WebSocketConfig,
): TypedSocketServer {
    if (_io) return _io;

    _io = new SocketServer<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        SocketData
    >(httpServer, {
        path: '/socket.io',
        pingInterval: 30_000,
        pingTimeout: 60_000,
        cors: {
            origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
            credentials: true,
        },
        // Limit payload size to prevent abuse
        maxHttpBufferSize: 1e6, // 1MB
    });

    // Set up Redis adapter for horizontal scaling if Redis URL is available
    if (config.redisUrl) {
        void setupRedisAdapter(config.redisUrl);
    }

    // Set up the /renders namespace
    const rendersNsp = _io.of('/renders');

    // Apply JWT authentication middleware
    rendersNsp.use(createAuthMiddleware(config.jwtSecret));

    // Register per-connection event handlers
    rendersNsp.on('connection', (socket) => {
        registerHandlers(socket);
    });

    return _io;
}

// ---------------------------------------------------------------------------
// Redis adapter (lazy-loaded to avoid hard dep in tests)
// ---------------------------------------------------------------------------

async function setupRedisAdapter(redisUrl: string): Promise<void> {
    try {
        const { createAdapter } = await import('@socket.io/redis-adapter');
        const { default: Redis } = await import('ioredis');

        const pubClient = new Redis(redisUrl);
        const subClient = new Redis(redisUrl);

        _io?.adapter(createAdapter(pubClient, subClient));
    } catch {
        // Redis adapter is optional — log and continue without it
        // In development or single-instance deployments this is fine
        console.warn('[ws] Redis adapter not available, running in single-instance mode');
    }
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/**
 * Get the initialised Socket.io server instance.
 * Returns null if not initialised (safe for services to check).
 */
export function getIO(): TypedSocketServer | null {
    return _io;
}

/**
 * Gracefully close the Socket.io server.
 */
export async function closeWebSocket(): Promise<void> {
    if (_io) {
        await new Promise<void>((resolve) => {
            _io!.close(() => resolve());
        });
        _io = null;
    }
}

/**
 * Reset the WebSocket singleton. **Test-only.**
 */
export function resetWebSocket(): void {
    _io = null;
}
