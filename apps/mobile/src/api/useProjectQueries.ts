/**
 * TanStack Query hooks for remote project operations.
 *
 * These hooks manage server state and provide optimistic updates,
 * background refetching, and cache invalidation.
 */
import {
    useQuery,
    useMutation,
    useQueryClient,
    type UseQueryResult,
    type UseMutationResult,
} from '@tanstack/react-query';
import type { CreateProjectInput, UpdateProjectInput } from '@renderflow/shared';

import {
    fetchProjects,
    fetchProject,
    createRemoteProject,
    updateRemoteProject,
    deleteRemoteProject,
    type ServerProject,
    type ProjectListResponse,
} from './projects';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const projectKeys = {
    all: ['projects'] as const,
    lists: () => [...projectKeys.all, 'list'] as const,
    list: (page: number) => [...projectKeys.lists(), page] as const,
    details: () => [...projectKeys.all, 'detail'] as const,
    detail: (id: string) => [...projectKeys.details(), id] as const,
} as const;

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetches all remote projects with 5-minute stale time
 * and background refetch on app focus.
 */
export function useRemoteProjects(
    page = 1,
    pageSize = 100,
): UseQueryResult<{ projects: ServerProject[]; meta: ProjectListResponse['meta'] }> {
    return useQuery({
        queryKey: projectKeys.list(page),
        queryFn: () => fetchProjects(page, pageSize),
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: true,
    });
}

/**
 * Fetches a single remote project by ID.
 */
export function useRemoteProject(
    remoteId: string | null,
): UseQueryResult<ServerProject> {
    return useQuery({
        queryKey: projectKeys.detail(remoteId ?? ''),
        queryFn: () => fetchProject(remoteId!),
        enabled: !!remoteId,
        staleTime: 5 * 60 * 1000,
    });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/**
 * Creates a project on the remote API.
 * Invalidates the project list cache on success.
 */
export function useCreateRemoteProject(): UseMutationResult<
    ServerProject,
    Error,
    CreateProjectInput
> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateProjectInput) => createRemoteProject(input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
        },
    });
}

/**
 * Updates a project on the remote API.
 * Invalidates both the list and detail caches on success.
 */
export function useUpdateRemoteProject(): UseMutationResult<
    ServerProject,
    Error,
    { remoteId: string; input: UpdateProjectInput }
> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ remoteId, input }) => updateRemoteProject(remoteId, input),
        onSuccess: (_data, { remoteId }) => {
            void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
            void queryClient.invalidateQueries({
                queryKey: projectKeys.detail(remoteId),
            });
        },
    });
}

/**
 * Deletes a project from the remote API.
 * Invalidates the project list cache on success.
 */
export function useDeleteRemoteProject(): UseMutationResult<
    void,
    Error,
    string
> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (remoteId: string) => deleteRemoteProject(remoteId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
        },
    });
}
