/**
 * Unit tests for the offline notification queue.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import {
    queueNotification,
    deliverPendingNotifications,
    setNotificationRedis,
    resetNotificationRedis,
} from '../notifications.js';
import type { NotificationRedisClient } from '../notifications.js';
import type { NotificationPayload } from '../types.js';

// ---------------------------------------------------------------------------
// In-memory Redis mock
// ---------------------------------------------------------------------------

function createMockRedis(): NotificationRedisClient & { _store: Map<string, string[]>; _ttls: Map<string, number> } {
    const store = new Map<string, string[]>();
    const ttls = new Map<string, number>();

    return {
        _store: store,
        _ttls: ttls,

        async rpush(key: string, ...values: string[]): Promise<number> {
            const list = store.get(key) ?? [];
            list.push(...values);
            store.set(key, list);
            return list.length;
        },

        async lrange(key: string, start: number, stop: number): Promise<string[]> {
            const list = store.get(key) ?? [];
            // Redis LRANGE: stop is inclusive, -1 means end
            const end = stop === -1 ? list.length : stop + 1;
            return list.slice(start, end);
        },

        async del(key: string): Promise<number> {
            const existed = store.has(key);
            store.delete(key);
            return existed ? 1 : 0;
        },

        async expire(key: string, seconds: number): Promise<number> {
            ttls.set(key, seconds);
            return 1;
        },
    };
}

// ---------------------------------------------------------------------------
// Mock socket
// ---------------------------------------------------------------------------

function createMockSocket() {
    const emitted: Array<{ event: string; payload: unknown }> = [];
    return {
        emit(event: string, payload: unknown) {
            emitted.push({ event, payload });
        },
        _emitted: emitted,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Notification Queue', () => {
    let mockRedis: ReturnType<typeof createMockRedis>;

    beforeEach(() => {
        mockRedis = createMockRedis();
        setNotificationRedis(mockRedis);
    });

    const sampleNotification: NotificationPayload = {
        type: 'success',
        title: 'Render Complete',
        message: 'Your video is ready to download',
        timestamp: new Date().toISOString(),
    };

    // -------------------------------------------------------------------
    // Queue
    // -------------------------------------------------------------------

    it('queues a notification in Redis', async () => {
        await queueNotification('user-1', sampleNotification);

        const stored = mockRedis._store.get('notifications:user-1');
        expect(stored).toHaveLength(1);
        expect(JSON.parse(stored![0]!)).toEqual(sampleNotification);
    });

    it('sets 24-hour TTL on the key', async () => {
        await queueNotification('user-1', sampleNotification);

        const ttl = mockRedis._ttls.get('notifications:user-1');
        expect(ttl).toBe(86400); // 24 * 60 * 60
    });

    it('queues multiple notifications in order', async () => {
        const notif1: NotificationPayload = {
            ...sampleNotification,
            title: 'First',
        };
        const notif2: NotificationPayload = {
            ...sampleNotification,
            title: 'Second',
        };

        await queueNotification('user-1', notif1);
        await queueNotification('user-1', notif2);

        const stored = mockRedis._store.get('notifications:user-1');
        expect(stored).toHaveLength(2);
        expect(JSON.parse(stored![0]!).title).toBe('First');
        expect(JSON.parse(stored![1]!).title).toBe('Second');
    });

    // -------------------------------------------------------------------
    // Deliver
    // -------------------------------------------------------------------

    it('delivers pending notifications to the socket', async () => {
        await queueNotification('user-1', sampleNotification);

        const socket = createMockSocket();
        await deliverPendingNotifications(socket as any, 'user-1');

        expect(socket._emitted).toHaveLength(1);
        expect(socket._emitted[0]!.event).toBe('notification');
        expect(socket._emitted[0]!.payload).toEqual(sampleNotification);
    });

    it('deletes notifications from Redis after delivery', async () => {
        await queueNotification('user-1', sampleNotification);

        const socket = createMockSocket();
        await deliverPendingNotifications(socket as any, 'user-1');

        expect(mockRedis._store.has('notifications:user-1')).toBe(false);
    });

    it('handles empty notification queue gracefully', async () => {
        const socket = createMockSocket();
        await deliverPendingNotifications(socket as any, 'user-1');

        expect(socket._emitted).toHaveLength(0);
    });

    it('skips malformed entries without crashing', async () => {
        // Manually insert a malformed entry
        mockRedis._store.set('notifications:user-1', [
            'not-valid-json',
            JSON.stringify(sampleNotification),
        ]);

        const socket = createMockSocket();
        await deliverPendingNotifications(socket as any, 'user-1');

        // Only the valid one should be emitted
        expect(socket._emitted).toHaveLength(1);
        expect(socket._emitted[0]!.payload).toEqual(sampleNotification);
    });

    // -------------------------------------------------------------------
    // No Redis
    // -------------------------------------------------------------------

    it('is a no-op when Redis is not configured', async () => {
        resetNotificationRedis();

        // Should not throw
        await queueNotification('user-1', sampleNotification);

        const socket = createMockSocket();
        await deliverPendingNotifications(socket as any, 'user-1');
        expect(socket._emitted).toHaveLength(0);
    });
});
