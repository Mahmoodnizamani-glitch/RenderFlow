/**
 * Drizzle ORM table definitions for the local SQLite database.
 *
 * Convention: snake_case column names in DB, camelCase in TypeScript.
 * JSON fields are stored as serialized text and validated with Zod on read.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects = sqliteTable('projects', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    code: text('code').notNull().default(''),
    thumbnailUri: text('thumbnail_uri'),
    compositionWidth: integer('composition_width').notNull().default(1920),
    compositionHeight: integer('composition_height').notNull().default(1080),
    fps: integer('fps').notNull().default(30),
    durationInFrames: integer('duration_in_frames').notNull().default(150),
    variables: text('variables').notNull().default('{}'),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    syncStatus: text('sync_status').notNull().default('local'),
    remoteId: text('remote_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
});

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export const assets = sqliteTable('assets', {
    id: text('id').primaryKey(),
    projectId: text('project_id')
        .notNull()
        .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: integer('file_size').notNull().default(0),
    localUri: text('local_uri'),
    remoteUrl: text('remote_url'),
    createdAt: text('created_at').notNull(),
});

// ---------------------------------------------------------------------------
// Render Jobs
// ---------------------------------------------------------------------------

export const renderJobs = sqliteTable('render_jobs', {
    id: text('id').primaryKey(),
    projectId: text('project_id')
        .notNull()
        .references(() => projects.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('queued'),
    renderType: text('render_type').notNull().default('cloud'),
    format: text('format').notNull().default('mp4'),
    quality: integer('quality').notNull().default(80),
    resolution: text('resolution').notNull().default('1920x1080'),
    fps: integer('fps').notNull().default(30),
    progress: integer('progress').notNull().default(0),
    currentFrame: integer('current_frame').notNull().default(0),
    totalFrames: integer('total_frames').notNull().default(0),
    outputUri: text('output_uri'),
    remoteJobId: text('remote_job_id'),
    errorMessage: text('error_message'),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    createdAt: text('created_at').notNull(),
});

// ---------------------------------------------------------------------------
// Pending Sync Actions
// ---------------------------------------------------------------------------

export const pendingSyncActions = sqliteTable('pending_sync_actions', {
    id: text('id').primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    changeType: text('change_type').notNull(),
    payload: text('payload').notNull().default('{}'),
    retryCount: integer('retry_count').notNull().default(0),
    status: text('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    createdAt: text('created_at').notNull(),
});
