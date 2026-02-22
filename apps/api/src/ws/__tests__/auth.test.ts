/**
 * Unit tests for Socket.io JWT authentication middleware.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Server as HttpServer} from 'node:http';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';

import { createAuthMiddleware } from '../auth.js';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const JWT_SECRET = 'test-secret-min-16-chars';
const TEST_PORT = 19880;

let httpServer: HttpServer;
let ioServer: SocketServer;

function createTestServer(): void {
    httpServer = createServer();
    ioServer = new SocketServer(httpServer);

    const nsp = ioServer.of('/renders');
    nsp.use(createAuthMiddleware(JWT_SECRET));

    nsp.on('connection', (socket) => {
        socket.emit('authenticated', { userId: socket.data.userId });
    });
}

function connectClient(auth: Record<string, unknown> = {}): ClientSocket {
    return ioClient(`http://localhost:${TEST_PORT}/renders`, {
        transports: ['websocket'],
        auth,
        forceNew: true,
    });
}

function makeToken(payload: Record<string, unknown>, options?: jwt.SignOptions): string {
    return jwt.sign(payload, JWT_SECRET, options);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebSocket Auth Middleware', () => {
    beforeAll(
        () =>
            new Promise<void>((resolve) => {
                createTestServer();
                httpServer.listen(TEST_PORT, resolve);
            }),
    );

    afterAll(
        () =>
            new Promise<void>((resolve) => {
                ioServer.close();
                httpServer.close(() => resolve());
            }),
    );

    // Clean up clients after each test
    let client: ClientSocket | null = null;
    afterEach(() => {
        client?.disconnect();
        client = null;
    });

    it('accepts connection with valid JWT in auth.token', async () => {
        const token = makeToken({ sub: 'user-123' }, { expiresIn: '1h' });
        client = connectClient({ token });

        const result = await new Promise<{ userId: string }>((resolve, reject) => {
            client!.on('authenticated', resolve);
            client!.on('connect_error', reject);
            setTimeout(() => reject(new Error('Timeout')), 3000);
        });

        expect(result.userId).toBe('user-123');
    });

    it('accepts connection with valid JWT in Authorization header', async () => {
        const token = makeToken({ sub: 'user-456' }, { expiresIn: '1h' });

        client = ioClient(`http://localhost:${TEST_PORT}/renders`, {
            transports: ['websocket'],
            forceNew: true,
            extraHeaders: {
                authorization: `Bearer ${token}`,
            },
        });

        const result = await new Promise<{ userId: string }>((resolve, reject) => {
            client!.on('authenticated', resolve);
            client!.on('connect_error', reject);
            setTimeout(() => reject(new Error('Timeout')), 3000);
        });

        expect(result.userId).toBe('user-456');
    });

    it('rejects connection with missing token', async () => {
        client = connectClient({});

        const error = await new Promise<Error>((resolve) => {
            client!.on('connect_error', resolve);
            setTimeout(() => resolve(new Error('Timeout')), 3000);
        });

        expect(error.message).toContain('Authentication required');
    });

    it('rejects connection with expired token', async () => {
        const token = makeToken({ sub: 'user-789' }, { expiresIn: '0s' });

        // Small delay to ensure the token is expired
        await new Promise((r) => setTimeout(r, 100));

        client = connectClient({ token });

        const error = await new Promise<Error>((resolve) => {
            client!.on('connect_error', resolve);
            setTimeout(() => resolve(new Error('Timeout')), 3000);
        });

        expect(error.message).toContain('Token expired');
    });

    it('rejects connection with malformed token', async () => {
        client = connectClient({ token: 'not-a-valid-jwt' });

        const error = await new Promise<Error>((resolve) => {
            client!.on('connect_error', resolve);
            setTimeout(() => resolve(new Error('Timeout')), 3000);
        });

        expect(error.message).toContain('Invalid token');
    });

    it('rejects connection with token missing sub claim', async () => {
        const token = makeToken({ role: 'admin' }, { expiresIn: '1h' });
        client = connectClient({ token });

        const error = await new Promise<Error>((resolve) => {
            client!.on('connect_error', resolve);
            setTimeout(() => resolve(new Error('Timeout')), 3000);
        });

        expect(error.message).toContain('Invalid token payload');
    });
});
