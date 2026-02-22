/**
 * Programmatic migration runner for Drizzle ORM.
 *
 * Called at server startup to ensure the database schema is up to date.
 * Uses Drizzle's built-in migration runner with the generated SQL files.
 */
import { migrate } from 'drizzle-orm/postgres-js/migrator';

import type { Database } from './connection.js';

/**
 * Run all pending Drizzle migrations.
 *
 * @param db — The initialised Drizzle client.
 * @param migrationsFolder — Path to the folder containing migration SQL files.
 *   Defaults to `src/db/migrations` relative to the API root.
 */
export async function runMigrations(
    db: Database,
    migrationsFolder = 'src/db/migrations',
): Promise<void> {
    await migrate(db, { migrationsFolder });
}
