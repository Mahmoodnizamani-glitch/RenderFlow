/**
 * Migration 0002 — creates the pending_sync_actions table.
 *
 * Stores queued local changes that need to be pushed to the cloud API.
 * Each row represents a single CRUD operation on a local entity.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 2;
export const name = '0002_pending_sync';

export function up(db: SQLiteDatabase): void {
    db.execSync(`
        CREATE TABLE IF NOT EXISTS pending_sync_actions (
            id              TEXT PRIMARY KEY NOT NULL,
            entity_type     TEXT NOT NULL,
            entity_id       TEXT NOT NULL,
            change_type     TEXT NOT NULL,
            payload         TEXT NOT NULL DEFAULT '{}',
            retry_count     INTEGER NOT NULL DEFAULT 0,
            status          TEXT NOT NULL DEFAULT 'pending',
            error_message   TEXT,
            created_at      TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_pending_sync_status
            ON pending_sync_actions(status);
        CREATE INDEX IF NOT EXISTS idx_pending_sync_entity
            ON pending_sync_actions(entity_type, entity_id);
    `);
}
