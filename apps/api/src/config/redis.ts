/**
 * Redis connection singleton using ioredis.
 *
 * Follows the same singleton pattern as `connection.ts`.
 * Used by BullMQ queues and any other Redis-dependent services.
 */
import Redis from 'ioredis';

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;

/**
 * Initialise the Redis connection singleton.
 * Safe to call multiple times — subsequent calls return the existing client.
 */
export function initRedis(url: string): Redis {
    if (_redis) return _redis;

    _redis = new Redis(url, {
        maxRetriesPerRequest: null, // Required by BullMQ
        enableReadyCheck: false,
        retryStrategy(times: number): number | null {
            if (times > 10) return null; // Stop retrying after 10 attempts
            return Math.min(times * 200, 5000);
        },
    });

    return _redis;
}

/**
 * Returns the initialised Redis client.
 * Throws if `initRedis()` has not been called.
 */
export function getRedis(): Redis {
    if (!_redis) {
        throw new Error('Redis not initialised. Call initRedis() first.');
    }
    return _redis;
}

/**
 * Gracefully close the Redis connection.
 */
export async function closeRedis(): Promise<void> {
    if (_redis) {
        await _redis.quit();
        _redis = null;
    }
}

/**
 * Reset the Redis singleton. **Test-only.**
 */
export function resetRedis(): void {
    _redis = null;
}
