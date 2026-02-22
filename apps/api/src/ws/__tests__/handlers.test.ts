/**
 * Unit tests for WebSocket event handlers.
 *
 * Tests room subscription, job ownership validation,
 * and multi-device event routing.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Server as HttpServer} from 'node:http';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';

import { createAuthMiddleware } from '../auth.js';
import { registerHandlers, setJobOwnershipChecker } from '../handlers.js';
import { resetNotificationRedis } from '../notifications.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const JWT_SECRET = 'test-secret-min-16-chars';
const TEST_PORT = 19881;
const USER_ID = 'user-handler-test';
const OTHER_USER_ID = 'user-other';
const JOB_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_JOB_ID = '660e8400-e29b-41d4-a716-446655440000';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let httpServer: HttpServer;
let ioServer: SocketServer;

function makeToken(userId: string): string {
    return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '1h' });
}

function connectClient(userId: string): ClientSocket {
    return ioClient(`http://localhost:${TEST_PORT}/renders`, {
        transports: ['websocket'],
        auth: { token: makeToken(userId) },
        forceNew: true,
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebSocket Handlers', () => {
    beforeAll(() => {
        // Mock: user owns JOB_ID but not OTHER_JOB_ID
        setJobOwnershipChecker(async (jobId, userId) => {
            return jobId === JOB_ID && userId === USER_ID;
        });

        // No Redis for notification tests here
        resetNotificationRedis();

        httpServer = createServer();
        ioServer = new SocketServer(httpServer);

        const nsp = ioServer.of('/renders');
        nsp.use(createAuthMiddleware(JWT_SECRET));
        nsp.on('connection', (socket) => {
            registerHandlers(socket);
        });

        return new Promise<void>((resolve) => {
            httpServer.listen(TEST_PORT, resolve);
        });
    });

    afterAll(
        () =>
            new Promise<void>((resolve) => {
                ioServer.close();
                httpServer.close(() => resolve());
            }),
    );

    const clients: ClientSocket[] = [];
    afterEach(() => {
        for (const c of clients) c.disconnect();
        clients.length = 0;
    });

    // -------------------------------------------------------------------
    // render:subscribe
    // -------------------------------------------------------------------

    it('subscribes to a job the user owns', async () => {
        const client = connectClient(USER_ID);
        clients.push(client);

        await new Promise<void>((resolve) => {
            client.on('connect', resolve);
        });

        const result = await new Promise<{ ok: boolean }>((resolve) => {
            client.emit('render:subscribe', { jobId: JOB_ID }, resolve);
        });

        expect(result.ok).toBe(true);
    });

    it('rejects subscription for job the user does not own', async () => {
        const client = connectClient(USER_ID);
        clients.push(client);

        await new Promise<void>((resolve) => {
            client.on('connect', resolve);
        });

        const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
            client.emit('render:subscribe', { jobId: OTHER_JOB_ID }, resolve);
        });

        expect(result.ok).toBe(false);
        expect(result.error).toContain('access denied');
    });

    it('rejects subscription with invalid payload', async () => {
        const client = connectClient(USER_ID);
        clients.push(client);

        await new Promise<void>((resolve) => {
            client.on('connect', resolve);
        });

        const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
            client.emit('render:subscribe', { jobId: 'not-a-uuid' }, resolve);
        });

        expect(result.ok).toBe(false);
        expect(result.error).toContain('Invalid payload');
    });

    // -------------------------------------------------------------------
    // render:unsubscribe
    // -------------------------------------------------------------------

    it('unsubscribes from a job room', async () => {
        const client = connectClient(USER_ID);
        clients.push(client);

        await new Promise<void>((resolve) => {
            client.on('connect', resolve);
        });

        // Subscribe first
        await new Promise<{ ok: boolean }>((resolve) => {
            client.emit('render:subscribe', { jobId: JOB_ID }, resolve);
        });

        // Then unsubscribe
        const result = await new Promise<{ ok: boolean }>((resolve) => {
            client.emit('render:unsubscribe', { jobId: JOB_ID }, resolve);
        });

        expect(result.ok).toBe(true);
    });

    // -------------------------------------------------------------------
    // Multi-device
    // -------------------------------------------------------------------

    it('supports multiple simultaneous connections for the same user', async () => {
        const client1 = connectClient(USER_ID);
        const client2 = connectClient(USER_ID);
        clients.push(client1, client2);

        await Promise.all([
            new Promise<void>((resolve) => client1.on('connect', resolve)),
            new Promise<void>((resolve) => client2.on('connect', resolve)),
        ]);

        // Both can subscribe to the same job
        const [result1, result2] = await Promise.all([
            new Promise<{ ok: boolean }>((resolve) => {
                client1.emit('render:subscribe', { jobId: JOB_ID }, resolve);
            }),
            new Promise<{ ok: boolean }>((resolve) => {
                client2.emit('render:subscribe', { jobId: JOB_ID }, resolve);
            }),
        ]);

        expect(result1.ok).toBe(true);
        expect(result2.ok).toBe(true);
    });

    // -------------------------------------------------------------------
    // Cross-user isolation
    // -------------------------------------------------------------------

    it('does not allow other users to subscribe to a job they do not own', async () => {
        const otherClient = connectClient(OTHER_USER_ID);
        clients.push(otherClient);

        await new Promise<void>((resolve) => {
            otherClient.on('connect', resolve);
        });

        const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
            otherClient.emit('render:subscribe', { jobId: JOB_ID }, resolve);
        });

        expect(result.ok).toBe(false);
    });
});
