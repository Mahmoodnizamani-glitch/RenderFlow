/**
 * Drizzle ORM schema for the RenderFlow PostgreSQL database.
 *
 * Tables: users, projects, assets, render_jobs, refresh_tokens
 *
 * This is the server-authoritative schema. The mobile app uses a
 * separate, device-local SQLite schema. Shared Zod schemas in
 * @renderflow/shared are the cross-platform data contract.
 */
import {
    pgTable,
    text,
    uuid,
    varchar,
    integer,
    bigint,
    boolean,
    timestamp,
    jsonb,
    pgEnum,
    index,
    uniqueIndex,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userTierEnum = pgEnum('user_tier', [
    'free',
    'pro',
    'team',
    'enterprise',
]);

export const assetTypeEnum = pgEnum('asset_type', [
    'image',
    'video',
    'audio',
    'font',
]);

export const renderJobStatusEnum = pgEnum('render_job_status', [
    'queued',
    'processing',
    'encoding',
    'completed',
    'failed',
    'cancelled',
]);

export const renderTypeEnum = pgEnum('render_type', ['local', 'cloud']);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable(
    'users',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        email: varchar('email', { length: 255 }).notNull(),
        passwordHash: text('password_hash').notNull(),
        displayName: varchar('display_name', { length: 255 }),
        avatarUrl: text('avatar_url'),
        tier: userTierEnum('tier').notNull().default('free'),
        renderCredits: integer('render_credits').notNull().default(5),
        settings: jsonb('settings').default({}),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    },
    (table) => [
        uniqueIndex('users_email_idx').on(table.email),
    ],
);

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects = pgTable(
    'projects',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        name: varchar('name', { length: 255 }).notNull(),
        description: text('description').default(''),
        code: text('code').default(''),
        thumbnailUrl: text('thumbnail_url'),
        compositionSettings: jsonb('composition_settings').default({
            width: 1920,
            height: 1080,
            fps: 30,
            durationInFrames: 150,
        }),
        variables: jsonb('variables').default({}),
        isTemplate: boolean('is_template').notNull().default(false),
        isPublic: boolean('is_public').notNull().default(false),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('projects_user_id_idx').on(table.userId),
    ],
);

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export const assets = pgTable(
    'assets',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        projectId: uuid('project_id')
            .references(() => projects.id, { onDelete: 'set null' }),
        name: varchar('name', { length: 255 }).notNull(),
        type: assetTypeEnum('type').notNull(),
        mimeType: varchar('mime_type', { length: 127 }).notNull(),
        fileSize: bigint('file_size', { mode: 'number' }).notNull(),
        storagePath: text('storage_path').notNull(),
        cdnUrl: text('cdn_url'),
        metadata: jsonb('metadata').default({}),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('assets_user_id_idx').on(table.userId),
        index('assets_project_id_idx').on(table.projectId),
    ],
);

// ---------------------------------------------------------------------------
// Render Jobs
// ---------------------------------------------------------------------------

export const renderJobs = pgTable(
    'render_jobs',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        projectId: uuid('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),
        status: renderJobStatusEnum('status').notNull().default('queued'),
        renderType: renderTypeEnum('render_type').notNull().default('cloud'),
        settings: jsonb('settings').default({}),
        creditsCharged: integer('credits_charged').notNull().default(0),
        codeUrl: text('code_url'),
        bullmqJobId: text('bullmq_job_id'),
        progress: integer('progress').notNull().default(0),
        currentFrame: integer('current_frame').notNull().default(0),
        totalFrames: integer('total_frames').notNull().default(0),
        outputUrl: text('output_url'),
        outputSize: bigint('output_size', { mode: 'number' }),
        errorMessage: text('error_message'),
        startedAt: timestamp('started_at', { withTimezone: true }),
        completedAt: timestamp('completed_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('render_jobs_user_id_idx').on(table.userId),
        index('render_jobs_project_id_idx').on(table.projectId),
        index('render_jobs_status_idx').on(table.status),
    ],
);

// ---------------------------------------------------------------------------
// Refresh Tokens
// ---------------------------------------------------------------------------

export const refreshTokens = pgTable(
    'refresh_tokens',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        tokenHash: text('token_hash').notNull(),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('refresh_tokens_user_id_idx').on(table.userId),
    ],
);

// ---------------------------------------------------------------------------
// Subscription Status & Provider Enums
// ---------------------------------------------------------------------------

export const subscriptionStatusEnum = pgEnum('subscription_status', [
    'active',
    'trialing',
    'past_due',
    'cancelled',
    'expired',
]);

export const subscriptionProviderEnum = pgEnum('subscription_provider', [
    'revenuecat',
    'stripe',
    'manual',
]);

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export const subscriptions = pgTable(
    'subscriptions',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        tier: userTierEnum('tier').notNull(),
        status: subscriptionStatusEnum('status').notNull().default('active'),
        provider: subscriptionProviderEnum('provider').notNull(),
        providerSubscriptionId: text('provider_subscription_id'),
        providerCustomerId: text('provider_customer_id'),
        currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
        currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
        cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
        trialEnd: timestamp('trial_end', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('subscriptions_user_id_idx').on(table.userId),
        index('subscriptions_provider_sub_id_idx').on(table.providerSubscriptionId),
        index('subscriptions_status_idx').on(table.status),
    ],
);

// ---------------------------------------------------------------------------
// Audit Action Enum
// ---------------------------------------------------------------------------

export const auditActionEnum = pgEnum('audit_action', [
    'login',
    'register',
    'logout',
    'password_change',
    'project_create',
    'project_delete',
    'render_submit',
    'render_complete',
    'render_fail',
    'credit_purchase',
    'tier_change',
    'data_export',
    'account_delete',
]);

// ---------------------------------------------------------------------------
// Audit Logs (append-only)
// ---------------------------------------------------------------------------

export const auditLogs = pgTable(
    'audit_logs',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        timestamp: timestamp('timestamp', { withTimezone: true })
            .notNull()
            .defaultNow(),
        userId: uuid('user_id'),
        action: auditActionEnum('action').notNull(),
        resourceType: varchar('resource_type', { length: 50 }),
        resourceId: uuid('resource_id'),
        ip: varchar('ip', { length: 45 }), // IPv6 max length
        userAgent: text('user_agent'),
        metadata: jsonb('metadata').default({}),
    },
    (table) => [
        index('audit_logs_user_id_idx').on(table.userId),
        index('audit_logs_action_idx').on(table.action),
        index('audit_logs_timestamp_idx').on(table.timestamp),
    ],
);
