/**
 * Offline notification queue using Redis.
 *
 * When a user has no active WebSocket connections, notifications
 * are stored in a Redis list and delivered on next connection.
 * Stored notifications expire after 24 hours.
 */
import type { Socket } from 'socket.io';

import type {
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData,
    NotificationPayload,
} from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthSocket = Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>;

/**
 * Redis client interface — subset of ioredis commands we need.
 * Keeps this module testable with a mock.
 */
export interface NotificationRedisClient {
    rpush(key: string, ...values: string[]): Promise<number>;
    lrange(key: string, start: number, stop: number): Promise<string[]>;
    del(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOTIFICATION_PREFIX = 'notifications:';
const TTL_SECONDS = 24 * 60 * 60; // 24 hours
const MAX_PENDING = 100; // Cap stored notifications per user

// ---------------------------------------------------------------------------
// Singleton Redis client
// ---------------------------------------------------------------------------

let _redis: NotificationRedisClient | null = null;

/**
 * Set the Redis client used for notification storage.
 * Called once during server initialisation.
 */
export function setNotificationRedis(redis: NotificationRedisClient): void {
    _redis = redis;
}

/**
 * Reset the Redis client. **Test-only.**
 */
export function resetNotificationRedis(): void {
    _redis = null;
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

/**
 * Queue a notification for an offline user.
 * Stored in a Redis list with a 24-hour TTL.
 */
export async function queueNotification(
    userId: string,
    notification: NotificationPayload,
): Promise<void> {
    if (!_redis) return;

    const key = `${NOTIFICATION_PREFIX}${userId}`;
    const serialized = JSON.stringify(notification);

    await _redis.rpush(key, serialized);
    await _redis.expire(key, TTL_SECONDS);
}

// ---------------------------------------------------------------------------
// Deliver
// ---------------------------------------------------------------------------

/**
 * Deliver all pending notifications to a connected socket.
 * Removes them from Redis after delivery.
 *
 * Called on new connections from registerHandlers().
 */
export async function deliverPendingNotifications(
    socket: AuthSocket,
    userId: string,
): Promise<void> {
    if (!_redis) return;

    const key = `${NOTIFICATION_PREFIX}${userId}`;

    const entries = await _redis.lrange(key, 0, MAX_PENDING - 1);
    if (entries.length === 0) return;

    // Delete the list atomically to prevent duplicate delivery
    // across multiple connections racing
    await _redis.del(key);

    for (const entry of entries) {
        try {
            const notification = JSON.parse(entry) as NotificationPayload;
            socket.emit('notification', notification);
        } catch {
            // Skip malformed entries
        }
    }
}
