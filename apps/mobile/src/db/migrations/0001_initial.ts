/**
 * Initial migration — creates all three core tables with indexes.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 1;
export const name = '0001_initial';

export function up(db: SQLiteDatabase): void {
    db.execSync(`
        CREATE TABLE IF NOT EXISTS projects (
            id              TEXT PRIMARY KEY NOT NULL,
            name            TEXT NOT NULL,
            description     TEXT NOT NULL DEFAULT '',
            code            TEXT NOT NULL DEFAULT '',
            thumbnail_uri   TEXT,
            composition_width  INTEGER NOT NULL DEFAULT 1920,
            composition_height INTEGER NOT NULL DEFAULT 1080,
            fps             INTEGER NOT NULL DEFAULT 30,
            duration_in_frames INTEGER NOT NULL DEFAULT 150,
            variables       TEXT NOT NULL DEFAULT '{}',
            is_favorite     INTEGER NOT NULL DEFAULT 0,
            sync_status     TEXT NOT NULL DEFAULT 'local',
            remote_id       TEXT,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assets (
            id              TEXT PRIMARY KEY NOT NULL,
            project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            name            TEXT NOT NULL,
            type            TEXT NOT NULL,
            mime_type       TEXT NOT NULL,
            file_size       INTEGER NOT NULL DEFAULT 0,
            local_uri       TEXT,
            remote_url      TEXT,
            created_at      TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS render_jobs (
            id              TEXT PRIMARY KEY NOT NULL,
            project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            status          TEXT NOT NULL DEFAULT 'queued',
            render_type     TEXT NOT NULL DEFAULT 'cloud',
            format          TEXT NOT NULL DEFAULT 'mp4',
            quality         INTEGER NOT NULL DEFAULT 80,
            resolution      TEXT NOT NULL DEFAULT '1920x1080',
            fps             INTEGER NOT NULL DEFAULT 30,
            progress        INTEGER NOT NULL DEFAULT 0,
            current_frame   INTEGER NOT NULL DEFAULT 0,
            total_frames    INTEGER NOT NULL DEFAULT 0,
            output_uri      TEXT,
            remote_job_id   TEXT,
            error_message   TEXT,
            started_at      TEXT,
            completed_at    TEXT,
            created_at      TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets(project_id);
        CREATE INDEX IF NOT EXISTS idx_render_jobs_project_id ON render_jobs(project_id);
        CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON render_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_projects_is_favorite ON projects(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_projects_sync_status ON projects(sync_status);
    `);
}
