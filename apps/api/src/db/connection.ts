/**
 * Database connection pool and Drizzle ORM client.
 *
 * Uses `postgres` (postgres.js) as the driver — pure JS, no native
 * bindings required. Connection pool size is configurable via env.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Database = ReturnType<typeof drizzle<typeof schema>>;

// ---------------------------------------------------------------------------
// Connection factory
// ---------------------------------------------------------------------------

let _sql: ReturnType<typeof postgres> | null = null;
let _db: Database | null = null;

/**
 * Initialise the database connection and return the Drizzle client.
 *
 * Safe to call multiple times — subsequent calls return the existing client.
 */
export function initDatabase(databaseUrl: string, maxConnections = 10): Database {
    if (_db) return _db;

    _sql = postgres(databaseUrl, {
        max: maxConnections,
        idle_timeout: 20,
        connect_timeout: 10,
    });

    _db = drizzle(_sql, { schema });

    return _db;
}

/**
 * Returns the initialised Drizzle client.
 * Throws if `initDatabase()` has not been called.
 */
export function getDatabase(): Database {
    if (!_db) {
        throw new Error('Database not initialised. Call initDatabase() first.');
    }
    return _db;
}

/**
 * Returns the raw postgres.js SQL client for health-check queries.
 * Throws if `initDatabase()` has not been called.
 */
export function getSql(): ReturnType<typeof postgres> {
    if (!_sql) {
        throw new Error('Database not initialised. Call initDatabase() first.');
    }
    return _sql;
}

/**
 * Gracefully close the database connection pool.
 */
export async function closeDatabase(): Promise<void> {
    if (_sql) {
        await _sql.end({ timeout: 5 });
        _sql = null;
        _db = null;
    }
}

/**
 * Reset singletons. **Test-only.**
 */
export function resetDatabase(): void {
    _sql = null;
    _db = null;
}
