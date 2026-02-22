/**
 * Unit tests for the WebSocket event emitter.
 *
 * Tests rate limiting, room routing, and event payloads.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Server as HttpServer} from 'node:http';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';

import { createAuthMiddleware } from '../auth.js';
import { registerHandlers, setJobOwnershipChecker } from '../handlers.js';
import { resetWebSocket as _resetWebSocket } from '../server.js';
import { resetNotificationRedis } from '../notifications.js';
import {
    emitRenderStarted,
    emitRenderProgress,
    emitRenderCompleted,
    emitRenderFailed,
    emitRenderCancelled,
    emitCreditsUpdated,
    resetProgressThrottles,
} from '../emitter.js';

// ---------------------------------------------------------------------------
// Monkey-patch getIO for testing
// ---------------------------------------------------------------------------

// We need to override getIO to return our test server
import * as serverModule from '../server.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const JWT_SECRET = 'test-secret-min-16-chars';
const TEST_PORT = 19882;
const USER_ID = 'user-emitter-test';
const JOB_ID = '550e8400-e29b-41d4-a716-446655440001';

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

describe('WebSocket Emitter', () => {
    beforeAll(() => {
        setJobOwnershipChecker(async () => true);
        resetNotificationRedis();

        httpServer = createServer();
        ioServer = new SocketServer(httpServer);

        // Override the getIO function to return our test server
        vi.spyOn(serverModule, 'getIO').mockReturnValue(ioServer as any);

        const nsp = ioServer.of('/renders');
        nsp.use(createAuthMiddleware(JWT_SECRET));
        nsp.on('connection', (socket) => {
            registerHandlers(socket);
        });

        return new Promise<void>((resolve) => {
            httpServer.listen(TEST_PORT, resolve);
        });
    });

    afterAll(() => {
        vi.restoreAllMocks();
        return new Promise<void>((resolve) => {
            ioServer.close();
            httpServer.close(() => resolve());
        });
    });

    beforeEach(() => {
        resetProgressThrottles();
    });

    const clients: ClientSocket[] = [];
    afterEach(() => {
        for (const c of clients) c.disconnect();
        clients.length = 0;
    });

    // -------------------------------------------------------------------
    // Event routing to user room
    // -------------------------------------------------------------------

    it('emits render:started to user room', async () => {
        const client = connectClient(USER_ID);
        clients.push(client);

        await new Promise<void>((resolve) => client.on('connect', resolve));

        const receivedEvent = new Promise<Record<string, unknown>>((resolve) => {
            client.on('render:started', resolve);
        });

        // Small delay to ensure room join has propagated
        await new Promise((r) => setTimeout(r, 100));

        emitRenderStarted(USER_ID, JOB_ID, {
            startedAt: new Date().toISOString(),
        });

        const payload = await receivedEvent;
        expect(payload).toHaveProperty('jobId', JOB_ID);
        expect(payload).toHaveProperty('startedAt');
    });

    it('emits render:completed to user room', async () => {
        const client = connectClient(USER_ID);
        clients.push(client);

        await new Promise<void>((resolve) => client.on('connect', resolve));
        await new Promise((r) => setTimeout(r, 100));

        const receivedEvent = new Promise<Record<string, unknown>>((resolve) => {
            client.on('render:completed', resolve);
        });

        emitRenderCompleted(USER_ID, JOB_ID, {
            outputUrl: 'https://r2.example.com/output.mp4',
            fileSize: 1024000,
            duration: 5000,
            completedAt: new Date().toISOString(),
        });

        const payload = await receivedEvent;
        expect(payload).toHaveProperty('jobId', JOB_ID);
        expect(payload).toHaveProperty('outputUrl');
        expect(payload).toHaveProperty('fileSize', 1024000);
    });

    it('emits render:failed to user room', async () => {
        const client = connectClient(USER_ID);
        clients.push(client);

        await new Promise<void>((resolve) => client.on('connect', resolve));
        await new Promise((r) => setTimeout(r, 100));

        const receivedEvent = new Promise<Record<string, unknown>>((resolve) => {
            client.on('render:failed', resolve);
        });

        emitRenderFailed(USER_ID, JOB_ID, {
            errorMessage: 'Chromium crashed',
            errorType: 'RENDER_ERROR',
            completedAt: new Date().toISOString(),
        });

        const payload = await receivedEvent;
        expect(payload).toHaveProperty('jobId', JOB_ID);
        expect(payload).toHaveProperty('errorMessage', 'Chromium crashed');
        expect(payload).toHaveProperty('errorType', 'RENDER_ERROR');
    });

    it('emits render:cancelled to user room', async () => {
        const client = connectClient(USER_ID);
        clients.push(client);

        await new Promise<void>((resolve) => client.on('connect', resolve));
        await new Promise((r) => setTimeout(r, 100));

        const receivedEvent = new Promise<Record<string, unknown>>((resolve) => {
            client.on('render:cancelled', resolve);
        });

        emitRenderCancelled(USER_ID, JOB_ID);

        const payload = await receivedEvent;
        expect(payload).toHaveProperty('jobId', JOB_ID);
    });

    it('emits credits:updated to user room', async () => {
        const client = connectClient(USER_ID);
        clients.push(client);

        await new Promise<void>((resolve) => client.on('connect', resolve));
        await new Promise((r) => setTimeout(r, 100));

        const receivedEvent = new Promise<Record<string, unknown>>((resolve) => {
            client.on('credits:updated', resolve);
        });

        emitCreditsUpdated(USER_ID, 42);

        const payload = await receivedEvent;
        expect(payload).toHaveProperty('balance', 42);
    });

    // -------------------------------------------------------------------
    // Progress rate limiting
    // -------------------------------------------------------------------

    it('rate-limits progress events to max 2 per second', async () => {
        const client = connectClient(USER_ID);
        clients.push(client);

        await new Promise<void>((resolve) => client.on('connect', resolve));
        await new Promise((r) => setTimeout(r, 100));

        const received: unknown[] = [];
        client.on('render:progress', (data: Record<string, unknown>) => {
            received.push(data);
        });

        // Emit 10 progress events rapidly
        for (let i = 0; i < 10; i++) {
            emitRenderProgress(USER_ID, JOB_ID, {
                currentFrame: i * 10,
                totalFrames: 100,
                percentage: i * 10,
                stage: 'rendering',
            });
        }

        // Wait for events to arrive
        await new Promise((r) => setTimeout(r, 300));

        // Should have received far fewer than 10 due to rate limiting
        // The first one always goes through, subsequent ones within 500ms are throttled
        expect(received.length).toBeLessThanOrEqual(2);
        expect(received.length).toBeGreaterThanOrEqual(1);
    });

    // -------------------------------------------------------------------
    // Cross-user isolation
    // -------------------------------------------------------------------

    it('does not emit to other users', async () => {
        const userClient = connectClient(USER_ID);
        const otherClient = connectClient('user-other');
        clients.push(userClient, otherClient);

        await Promise.all([
            new Promise<void>((resolve) => userClient.on('connect', resolve)),
            new Promise<void>((resolve) => otherClient.on('connect', resolve)),
        ]);
        await new Promise((r) => setTimeout(r, 100));

        let otherReceived = false;
        otherClient.on('render:started', () => {
            otherReceived = true;
        });

        const userReceivedEvent = new Promise<Record<string, unknown>>((resolve) => {
            userClient.on('render:started', resolve);
        });

        emitRenderStarted(USER_ID, JOB_ID, {
            startedAt: new Date().toISOString(),
        });

        await userReceivedEvent;
        // Give other client time to receive (if it would)
        await new Promise((r) => setTimeout(r, 200));

        expect(otherReceived).toBe(false);
    });
});
