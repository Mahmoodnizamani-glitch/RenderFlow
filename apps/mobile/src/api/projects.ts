/**
 * Project API module.
 *
 * Typed wrappers for the backend project CRUD endpoints.
 * Maps between local Project shape (mobile) and server ProjectRow shape (API).
 */
import type { Project, CreateProjectInput, UpdateProjectInput } from '@renderflow/shared';
import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Server response types (match backend serialiseProject output)
// ---------------------------------------------------------------------------

interface ServerProject {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    code: string | null;
    thumbnailUrl: string | null;
    compositionSettings: Record<string, unknown> | null;
    variables: Record<string, unknown> | null;
    isTemplate: boolean;
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
}

interface ProjectResponse {
    project: ServerProject;
}

interface ProjectListResponse {
    data: ServerProject[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/**
 * Maps a server project to the local Project shape.
 * Server-only fields (userId, isTemplate, isPublic) are dropped.
 * Mobile-only fields get safe defaults.
 */
function serverToLocal(server: ServerProject, existing?: Partial<Project>): Project {
    const compositionSettings = server.compositionSettings ?? {};
    return {
        id: existing?.id ?? server.id,
        name: server.name,
        description: server.description ?? '',
        code: server.code ?? '',
        thumbnailUri: server.thumbnailUrl ?? existing?.thumbnailUri ?? null,
        compositionWidth:
            (compositionSettings['width'] as number | undefined) ??
            existing?.compositionWidth ??
            1920,
        compositionHeight:
            (compositionSettings['height'] as number | undefined) ??
            existing?.compositionHeight ??
            1080,
        fps:
            (compositionSettings['fps'] as number | undefined) ??
            existing?.fps ??
            30,
        durationInFrames:
            (compositionSettings['durationInFrames'] as number | undefined) ??
            existing?.durationInFrames ??
            150,
        variables: server.variables ?? existing?.variables ?? {},
        isFavorite: existing?.isFavorite ?? false,
        syncStatus: 'synced',
        remoteId: server.id,
        createdAt: server.createdAt,
        updatedAt: server.updatedAt,
    };
}

/**
 * Maps a local Project to the server create/update payload.
 * Mobile-only fields are packed into compositionSettings.
 */
function localToServerCreate(local: CreateProjectInput): Record<string, unknown> {
    return {
        name: local.name,
        description: local.description ?? '',
        code: local.code ?? '',
        compositionSettings: {
            width: local.compositionWidth ?? 1920,
            height: local.compositionHeight ?? 1080,
            fps: local.fps ?? 30,
            durationInFrames: local.durationInFrames ?? 150,
        },
        variables: local.variables ?? {},
    };
}

function localToServerUpdate(local: UpdateProjectInput): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (local.name !== undefined) payload['name'] = local.name;
    if (local.description !== undefined) payload['description'] = local.description;
    if (local.code !== undefined) payload['code'] = local.code;

    const settings: Record<string, unknown> = {};
    if (local.compositionWidth !== undefined) settings['width'] = local.compositionWidth;
    if (local.compositionHeight !== undefined) settings['height'] = local.compositionHeight;
    if (local.fps !== undefined) settings['fps'] = local.fps;
    if (local.durationInFrames !== undefined) settings['durationInFrames'] = local.durationInFrames;

    if (Object.keys(settings).length > 0) {
        payload['compositionSettings'] = settings;
    }

    if (local.variables !== undefined) payload['variables'] = local.variables;

    return payload;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Fetch all projects from the backend (paginated).
 */
export async function fetchProjects(
    page = 1,
    pageSize = 100,
): Promise<{ projects: ServerProject[]; meta: ProjectListResponse['meta'] }> {
    const response = await apiClient.get<ProjectListResponse>('/projects', {
        params: { page, pageSize },
    });
    return { projects: response.data.data, meta: response.data.meta };
}

/**
 * Fetch a single project by its remote ID.
 */
export async function fetchProject(remoteId: string): Promise<ServerProject> {
    const response = await apiClient.get<ProjectResponse>(`/projects/${remoteId}`);
    return response.data.project;
}

/**
 * Create a project on the backend.
 */
export async function createRemoteProject(
    input: CreateProjectInput,
): Promise<ServerProject> {
    const payload = localToServerCreate(input);
    const response = await apiClient.post<ProjectResponse>('/projects', payload);
    return response.data.project;
}

/**
 * Update a project on the backend.
 */
export async function updateRemoteProject(
    remoteId: string,
    input: UpdateProjectInput,
): Promise<ServerProject> {
    const payload = localToServerUpdate(input);
    const response = await apiClient.put<ProjectResponse>(
        `/projects/${remoteId}`,
        payload,
    );
    return response.data.project;
}

/**
 * Delete a project on the backend.
 */
export async function deleteRemoteProject(remoteId: string): Promise<void> {
    await apiClient.delete(`/projects/${remoteId}`);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { serverToLocal, localToServerCreate, localToServerUpdate };
export type { ServerProject, ProjectListResponse };
