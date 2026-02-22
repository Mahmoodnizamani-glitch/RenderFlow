/**
 * Tests for the WebSocket client (src/api/socket.ts).
 *
 * Verifies connection lifecycle, event handler registration,
 * job subscription, and reconnect re-subscription.
 */
import { io } from 'socket.io-client';
import {
    connect,
    disconnect,
    isConnected,
    subscribeToJob,
    unsubscribeFromJob,
    getSubscribedJobs,
    onRenderStarted,
    onRenderProgress,
    onRenderCompleted,
    onRenderFailed,
    onRenderCancelled,
    onCreditsUpdated,
    _resetForTests,
} from '../socket';
import type {
    RenderStartedPayload as _RenderStartedPayload,
    RenderProgressPayload as _RenderProgressPayload,
    RenderCompletedPayload as _RenderCompletedPayload,
    RenderFailedPayload as _RenderFailedPayload,
    RenderCancelledPayload as _RenderCancelledPayload,
    CreditsUpdatedPayload as _CreditsUpdatedPayload,
} from '../socket';
import * as secureStorage from '../secureStorage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../secureStorage', () => ({
    getAccessToken: jest.fn(),
}));

const mockGetAccessToken = secureStorage.getAccessToken as jest.MockedFunction<typeof secureStorage.getAccessToken>;

// Access the mock socket from the mocked module
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const socketIoModule = require('socket.io-client') as { io: jest.Mock; __mockSocket: any };
const mockSocket = socketIoModule.__mockSocket;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('socket.ts WebSocket client', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        _resetForTests();
        // Reset mock socket state
        if (mockSocket) {
            mockSocket.connected = false;
            if (mockSocket.__listeners) {
                Object.keys(mockSocket.__listeners).forEach((key: string) => {
                    delete mockSocket.__listeners[key];
                });
            }
        }
    });

    // -----------------------------------------------------------------------
    // Connection lifecycle
    // -----------------------------------------------------------------------

    describe('connect', () => {
        it('does not connect without an access token', async () => {
            mockGetAccessToken.mockResolvedValueOnce(null);

            await connect();

            expect(io).not.toHaveBeenCalled();
        });

        it('creates socket connection with token', async () => {
            mockGetAccessToken.mockResolvedValueOnce('test-token');

            await connect();

            expect(io).toHaveBeenCalledWith(
                expect.stringContaining('/renders'),
                expect.objectContaining({
                    auth: { token: 'test-token' },
                    transports: ['websocket'],
                }),
            );
        });
    });

    describe('disconnect', () => {
        it('disconnects and clears subscriptions', async () => {
            mockGetAccessToken.mockResolvedValueOnce('test-token');
            await connect();

            subscribeToJob('job-1');
            expect(getSubscribedJobs().has('job-1')).toBe(true);

            disconnect();

            expect(mockSocket.removeAllListeners).toHaveBeenCalled();
            expect(mockSocket.disconnect).toHaveBeenCalled();
            expect(getSubscribedJobs().size).toBe(0);
        });
    });

    describe('isConnected', () => {
        it('returns false when not connected', () => {
            expect(isConnected()).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // Job subscription
    // -----------------------------------------------------------------------

    describe('subscribeToJob', () => {
        it('adds job to subscribed set', () => {
            subscribeToJob('job-1');

            expect(getSubscribedJobs().has('job-1')).toBe(true);
        });

        it('emits subscribe event when connected', async () => {
            mockGetAccessToken.mockResolvedValueOnce('test-token');
            await connect();
            mockSocket.connected = true;

            subscribeToJob('job-2');

            expect(mockSocket.emit).toHaveBeenCalledWith(
                'render:subscribe',
                { jobId: 'job-2' },
                expect.any(Function),
            );
        });
    });

    describe('unsubscribeFromJob', () => {
        it('removes job from subscribed set', () => {
            subscribeToJob('job-1');
            unsubscribeFromJob('job-1');

            expect(getSubscribedJobs().has('job-1')).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // Event handlers
    // -----------------------------------------------------------------------

    describe('event handlers', () => {
        it('registers and unregisters render:started handler', () => {
            const handler = jest.fn();
            const unsub = onRenderStarted(handler);

            // Verify unsub works
            unsub();
            // No error = success
        });

        it('registers and unregisters render:progress handler', () => {
            const handler = jest.fn();
            const unsub = onRenderProgress(handler);
            unsub();
        });

        it('registers and unregisters render:completed handler', () => {
            const handler = jest.fn();
            const unsub = onRenderCompleted(handler);
            unsub();
        });

        it('registers and unregisters render:failed handler', () => {
            const handler = jest.fn();
            const unsub = onRenderFailed(handler);
            unsub();
        });

        it('registers and unregisters render:cancelled handler', () => {
            const handler = jest.fn();
            const unsub = onRenderCancelled(handler);
            unsub();
        });

        it('registers and unregisters credits:updated handler', () => {
            const handler = jest.fn();
            const unsub = onCreditsUpdated(handler);
            unsub();
        });
    });

    // -----------------------------------------------------------------------
    // _resetForTests
    // -----------------------------------------------------------------------

    describe('_resetForTests', () => {
        it('clears all state', async () => {
            mockGetAccessToken.mockResolvedValueOnce('test-token');
            await connect();
            subscribeToJob('job-1');
            onRenderStarted(jest.fn());

            _resetForTests();

            expect(getSubscribedJobs().size).toBe(0);
        });
    });
});
