/**
 * Shared type definitions for the render worker.
 *
 * These mirror the BullMQ job data shapes defined in the API's
 * `queue.service.ts` and provide strong typing for the pipeline.
 */

// ---------------------------------------------------------------------------
// Render job data (from BullMQ queue)
// ---------------------------------------------------------------------------

/**
 * Data payload attached to each BullMQ render job.
 * Mirrors `RenderJobData` from `apps/api/src/services/queue.service.ts`.
 */
export interface RenderJobData {
    renderJobId: string;
    userId: string;
    projectId: string;
    codeUrl: string;
    assets: Array<{ name: string; url: string }>;
    compositionSettings: Record<string, unknown>;
    renderSettings: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Render settings (typed subset)
// ---------------------------------------------------------------------------

/** Typed render settings extracted from the generic record. */
export interface TypedRenderSettings {
    width: number;
    height: number;
    fps: number;
    durationInFrames: number;
    format: OutputFormat;
    quality?: number;
}

// ---------------------------------------------------------------------------
// Output format
// ---------------------------------------------------------------------------

export type OutputFormat = 'mp4' | 'webm' | 'gif';

export const VALID_FORMATS: ReadonlySet<string> = new Set(['mp4', 'webm', 'gif']);

// ---------------------------------------------------------------------------
// Render stages
// ---------------------------------------------------------------------------

export type RenderStage =
    | 'fetching'
    | 'preparing'
    | 'bundling'
    | 'rendering'
    | 'uploading';

// ---------------------------------------------------------------------------
// Progress data
// ---------------------------------------------------------------------------

export interface ProgressData {
    currentFrame: number;
    totalFrames: number;
    percentage: number;
    stage: RenderStage;
}

// ---------------------------------------------------------------------------
// Pipeline result
// ---------------------------------------------------------------------------

export interface RenderResult {
    outputUrl: string;
    outputSize: number;
    durationMs: number;
}

// ---------------------------------------------------------------------------
// Codec mapping
// ---------------------------------------------------------------------------

export type RemotionCodec = 'h264' | 'vp8' | 'gif';

export const FORMAT_TO_CODEC: Record<OutputFormat, RemotionCodec> = {
    mp4: 'h264',
    webm: 'vp8',
    gif: 'gif',
};

export const FORMAT_TO_EXTENSION: Record<OutputFormat, string> = {
    mp4: 'mp4',
    webm: 'webm',
    gif: 'gif',
};

export const FORMAT_TO_MIME: Record<OutputFormat, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    gif: 'image/gif',
};
