/**
 * Unit tests for the health check server.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import {
    startHealthServer,
    stopHealthServer,
    setReady,
    setActiveJobs,
} from '../health.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function httpGet(port: number, path: string): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
            let body = '';
            res.on('data', (chunk: Buffer) => {
                body += chunk.toString();
            });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode ?? 500, body });
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Health Check Server', () => {
    const TEST_PORT = 19876;

    // Start the server once for all tests to avoid ECONNRESET races
    beforeAll(async () => {
        await startHealthServer(TEST_PORT);
    });

    afterAll(async () => {
        await stopHealthServer();
    });

    it('responds with 503 when not ready', async () => {
        setReady(false);
        setActiveJobs(0);

        const res = await httpGet(TEST_PORT, '/health');

        expect(res.statusCode).toBe(503);
        const body = JSON.parse(res.body);
        expect(body.status).toBe('starting');
    });

    it('responds with 200 when ready', async () => {
        setReady(true);

        const res = await httpGet(TEST_PORT, '/health');

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.status).toBe('healthy');
        expect(typeof body.uptime).toBe('number');
        expect(typeof body.activeJobs).toBe('number');
        expect(typeof body.memoryUsage).toBe('number');
        expect(typeof body.timestamp).toBe('string');
    });

    it('reports active job count', async () => {
        setReady(true);
        setActiveJobs(3);

        const res = await httpGet(TEST_PORT, '/health');
        const body = JSON.parse(res.body);

        expect(body.activeJobs).toBe(3);
    });

    it('returns 404 for non-health paths', async () => {
        const res = await httpGet(TEST_PORT, '/other');

        expect(res.statusCode).toBe(404);
    });

    it('is idempotent to start multiple times', async () => {
        const server1 = await startHealthServer(TEST_PORT);
        const server2 = await startHealthServer(TEST_PORT);

        expect(server1).toBe(server2);
    });
});

describe('Health Check Server — stop', () => {
    const STOP_PORT = 19877;

    it('gracefully stops and rejects connections', async () => {
        await startHealthServer(STOP_PORT);
        await stopHealthServer();

        await expect(httpGet(STOP_PORT, '/health')).rejects.toThrow();
    });
});
