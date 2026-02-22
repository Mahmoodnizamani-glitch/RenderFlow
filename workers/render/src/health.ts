/**
 * Health check HTTP server for the render worker.
 *
 * Responds to `GET /health` with a JSON status report.
 * Used by Docker HEALTHCHECK and orchestrators to verify worker readiness.
 */
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { logger } from './config/logger.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _server: Server | null = null;
let _isReady = false;
let _activeJobs = 0;

/**
 * Mark the worker as ready (all BullMQ workers connected).
 */
export function setReady(ready: boolean): void {
    _isReady = ready;
}

/**
 * Update the count of active jobs being processed.
 */
export function setActiveJobs(count: number): void {
    _activeJobs = count;
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
    if (req.method === 'GET' && req.url === '/health') {
        const status = _isReady ? 'healthy' : 'starting';
        const statusCode = _isReady ? 200 : 503;

        const body = JSON.stringify({
            status,
            uptime: process.uptime(),
            activeJobs: _activeJobs,
            memoryUsage: process.memoryUsage().heapUsed,
            timestamp: new Date().toISOString(),
        });

        res.writeHead(statusCode, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
        });
        res.end(body);
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
}

// ---------------------------------------------------------------------------
// Start / Stop
// ---------------------------------------------------------------------------

/**
 * Start the health check HTTP server on the given port.
 */
export function startHealthServer(port: number): Promise<Server> {
    return new Promise((resolve, reject) => {
        if (_server) {
            resolve(_server);
            return;
        }

        _server = createServer(handleRequest);

        _server.on('error', (err: NodeJS.ErrnoException) => {
            logger.error('Health server error', { error: err.message });
            reject(err);
        });

        _server.listen(port, '0.0.0.0', () => {
            logger.info('Health check server started', { port });
            resolve(_server!);
        });
    });
}

/**
 * Gracefully stop the health check server.
 */
export function stopHealthServer(): Promise<void> {
    return new Promise((resolve) => {
        if (!_server) {
            resolve();
            return;
        }

        _server.close(() => {
            _server = null;
            resolve();
        });
    });
}
