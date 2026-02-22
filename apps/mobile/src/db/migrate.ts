/**
 * Migration runner for the local SQLite database.
 *
 * Tracks applied migrations in a `_migrations` metadata table within SQLite.
 * Each migration has a numeric `version` and an `up(db)` function.
 * Migrations are applied in version order, and each is only applied once.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { getRawDb } from './client';
import { AppError } from '../errors/AppError';

// ---------------------------------------------------------------------------
// Migration type
// ---------------------------------------------------------------------------

interface Migration {
    version: number;
    name: string;
    up: (db: SQLiteDatabase) => void;
}

// ---------------------------------------------------------------------------
// Registry — import all migrations here in order
// ---------------------------------------------------------------------------

import * as initial from './migrations/0001_initial';
import * as pendingSync from './migrations/0002_pending_sync';

const ALL_MIGRATIONS: Migration[] = [initial, pendingSync];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Ensures the `_migrations` table exists.
 */
function ensureMigrationsTable(db: SQLiteDatabase): void {
    db.execSync(`
        CREATE TABLE IF NOT EXISTS _migrations (
            version     INTEGER PRIMARY KEY NOT NULL,
            name        TEXT NOT NULL,
            applied_at  TEXT NOT NULL
        );
    `);
}

/**
 * Returns the highest migration version that has been applied.
 */
function getCurrentVersion(db: SQLiteDatabase): number {
    const result = db.getFirstSync<{ max_version: number | null }>(
        'SELECT MAX(version) as max_version FROM _migrations',
    );
    return result?.max_version ?? 0;
}

/**
 * Records a migration as applied.
 */
function recordMigration(db: SQLiteDatabase, migration: Migration): void {
    db.runSync(
        'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        new Date().toISOString(),
    );
}

/**
 * Runs all pending database migrations in version order.
 *
 * Safe to call on every app start — already-applied migrations are skipped.
 * Throws `AppError` with code `MIGRATION_ERROR` if any migration fails.
 */
export async function runMigrations(): Promise<void> {
    const db = getRawDb();

    try {
        ensureMigrationsTable(db);
        const currentVersion = getCurrentVersion(db);

        const pending = ALL_MIGRATIONS.filter((m) => m.version > currentVersion).sort(
            (a, b) => a.version - b.version,
        );

        if (pending.length === 0) {
            return;
        }

        for (const migration of pending) {
            migration.up(db);
            recordMigration(db, migration);
        }
    } catch (error: unknown) {
        if (AppError.is(error)) {
            throw error;
        }
        throw AppError.migration(
            'Failed to run database migrations',
            error instanceof Error ? error : new Error(String(error)),
        );
    }
}
