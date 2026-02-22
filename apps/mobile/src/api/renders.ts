/**
 * Render API module.
 *
 * Typed wrappers for the backend render job endpoints.
 * Maps between server RenderJobRow and local RenderJob shapes.
 */
import type { RenderJob, RenderJobStatus } from '@renderflow/shared';
import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Server response types
// ---------------------------------------------------------------------------

export interface ServerRenderJob {
    id: string;
    userId: string;
    projectId: string;
    status: string;
    renderType: string;
    settings: {
        width: number;
        height: number;
        fps: number;
        durationInFrames: number;
        format: string;
    };
    creditsCharged: number;
    progress: number;
    currentFrame: number;
    totalFrames: number;
    outputUrl: string | null;
    outputSize: number | null;
    errorMessage: string | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
}

export interface SubmitRenderInput {
    projectId: string;
    settings: {
        width: number;
        height: number;
        fps: number;
        durationInFrames: number;
        format: 'mp4' | 'webm' | 'gif';
    };
    /** Optional code URL — server fetches from project if omitted */
    codeUrl?: string;
    assets?: Array<{ name: string; url: string }>;
    compositionSettings?: Record<string, unknown>;
}

export interface RenderListFilters {
    page?: number;
    pageSize?: number;
    status?: RenderJobStatus;
}

export interface DownloadUrlResponse {
    downloadUrl: string;
    expiresIn: number;
}

// ---------------------------------------------------------------------------
// Mapper: Server → Local
// ---------------------------------------------------------------------------

function resolutionFromSettings(settings: ServerRenderJob['settings']): string {
    return `${settings.width}x${settings.height}`;
}

export function serverRenderToLocal(server: ServerRenderJob): RenderJob {
    return {
        id: server.id,
        projectId: server.projectId,
        status: server.status as RenderJobStatus,
        renderType: server.renderType as 'cloud' | 'local',
        format: server.settings.format,
        quality: 80, // Server doesn't store quality numeric; use default
        resolution: resolutionFromSettings(server.settings),
        fps: server.settings.fps,
        progress: server.progress,
        currentFrame: server.currentFrame,
        totalFrames: server.totalFrames,
        outputUri: server.outputUrl,
        remoteJobId: server.id,
        errorMessage: server.errorMessage,
        startedAt: server.startedAt,
        completedAt: server.completedAt,
        createdAt: server.createdAt,
    };
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Submit a new render job.
 * POST /renders
 */
export async function submitRender(input: SubmitRenderInput): Promise<RenderJob> {
    const { data } = await apiClient.post<{ renderJob: ServerRenderJob }>('/renders', input);
    return serverRenderToLocal(data.renderJob);
}

/**
 * List render jobs with optional filters.
 * GET /renders
 */
export async function getRenders(
    filters: RenderListFilters = {},
): Promise<{ renders: RenderJob[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }> {
    const { data } = await apiClient.get<{
        data: ServerRenderJob[];
        meta: { total: number; page: number; pageSize: number; totalPages: number };
    }>('/renders', {
        params: {
            page: filters.page ?? 1,
            pageSize: filters.pageSize ?? 50,
            ...(filters.status ? { status: filters.status } : {}),
        },
    });

    return {
        renders: data.data.map(serverRenderToLocal),
        meta: data.meta,
    };
}

/**
 * Get a single render job status.
 * GET /renders/:id
 */
export async function getRenderStatus(jobId: string): Promise<RenderJob> {
    const { data } = await apiClient.get<{ renderJob: ServerRenderJob }>(`/renders/${jobId}`);
    return serverRenderToLocal(data.renderJob);
}

/**
 * Cancel a render job.
 * POST /renders/:id/cancel
 */
export async function cancelRender(jobId: string): Promise<RenderJob> {
    const { data } = await apiClient.post<{ renderJob: ServerRenderJob }>(`/renders/${jobId}/cancel`);
    return serverRenderToLocal(data.renderJob);
}

/**
 * Get a signed download URL for a completed render.
 * GET /renders/:id/download
 */
export async function getDownloadUrl(jobId: string): Promise<DownloadUrlResponse> {
    const { data } = await apiClient.get<DownloadUrlResponse>(`/renders/${jobId}/download`);
    return data;
}
