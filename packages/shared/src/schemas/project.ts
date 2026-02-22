/**
 * @renderflow/shared — Project, Asset, and RenderJob schemas.
 *
 * These Zod schemas are the source of truth for all entity types
 * across the mobile app and API.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const SyncStatusEnum = z.enum(['local', 'syncing', 'synced', 'conflict']);
export type SyncStatus = z.infer<typeof SyncStatusEnum>;

export const AssetTypeEnum = z.enum(['image', 'video', 'audio', 'font']);
export type AssetType = z.infer<typeof AssetTypeEnum>;

export const RenderJobStatusEnum = z.enum([
    'queued',
    'processing',
    'encoding',
    'completed',
    'failed',
]);
export type RenderJobStatus = z.infer<typeof RenderJobStatusEnum>;

export const RenderTypeEnum = z.enum(['local', 'cloud']);
export type RenderType = z.infer<typeof RenderTypeEnum>;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export const ProjectSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().max(2000).default(''),
    code: z.string().default(''),
    thumbnailUri: z.string().nullable().default(null),
    compositionWidth: z.number().int().positive().default(1920),
    compositionHeight: z.number().int().positive().default(1080),
    fps: z.number().int().positive().max(120).default(30),
    durationInFrames: z.number().int().positive().default(150),
    variables: z.record(z.unknown()).default({}),
    isFavorite: z.boolean().default(false),
    syncStatus: SyncStatusEnum.default('local'),
    remoteId: z.string().nullable().default(null),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectInputSchema = ProjectSchema.pick({
    name: true,
    description: true,
    code: true,
    thumbnailUri: true,
    compositionWidth: true,
    compositionHeight: true,
    fps: true,
    durationInFrames: true,
    variables: true,
}).partial({
    description: true,
    code: true,
    thumbnailUri: true,
    compositionWidth: true,
    compositionHeight: true,
    fps: true,
    durationInFrames: true,
    variables: true,
});

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export const UpdateProjectInputSchema = ProjectSchema.pick({
    name: true,
    description: true,
    code: true,
    thumbnailUri: true,
    compositionWidth: true,
    compositionHeight: true,
    fps: true,
    durationInFrames: true,
    variables: true,
    isFavorite: true,
    syncStatus: true,
    remoteId: true,
}).partial();

export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;

// ---------------------------------------------------------------------------
// Asset
// ---------------------------------------------------------------------------

export const AssetSchema = z.object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    name: z.string().min(1).max(255),
    type: AssetTypeEnum,
    mimeType: z.string().min(1).max(127),
    fileSize: z.number().int().nonnegative(),
    localUri: z.string().nullable().default(null),
    remoteUrl: z.string().url().nullable().default(null),
    createdAt: z.string().datetime(),
});

export type Asset = z.infer<typeof AssetSchema>;

export const CreateAssetInputSchema = AssetSchema.pick({
    projectId: true,
    name: true,
    type: true,
    mimeType: true,
    fileSize: true,
    localUri: true,
    remoteUrl: true,
}).partial({
    localUri: true,
    remoteUrl: true,
});

export type CreateAssetInput = z.infer<typeof CreateAssetInputSchema>;

// ---------------------------------------------------------------------------
// Render Job
// ---------------------------------------------------------------------------

export const RenderJobSchema = z.object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    status: RenderJobStatusEnum.default('queued'),
    renderType: RenderTypeEnum.default('cloud'),
    format: z.string().min(1).max(31).default('mp4'),
    quality: z.number().int().min(1).max(100).default(80),
    resolution: z.string().max(31).default('1920x1080'),
    fps: z.number().int().positive().max(120).default(30),
    progress: z.number().min(0).max(100).default(0),
    currentFrame: z.number().int().nonnegative().default(0),
    totalFrames: z.number().int().nonnegative().default(0),
    outputUri: z.string().nullable().default(null),
    remoteJobId: z.string().nullable().default(null),
    errorMessage: z.string().nullable().default(null),
    startedAt: z.string().datetime().nullable().default(null),
    completedAt: z.string().datetime().nullable().default(null),
    createdAt: z.string().datetime(),
});

export type RenderJob = z.infer<typeof RenderJobSchema>;

export const CreateRenderJobInputSchema = RenderJobSchema.pick({
    projectId: true,
    renderType: true,
    format: true,
    quality: true,
    resolution: true,
    fps: true,
    totalFrames: true,
}).partial({
    renderType: true,
    format: true,
    quality: true,
    resolution: true,
    fps: true,
    totalFrames: true,
});

export type CreateRenderJobInput = z.infer<typeof CreateRenderJobInputSchema>;
