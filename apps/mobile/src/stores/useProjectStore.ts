/**
 * Zustand store for Project state management.
 *
 * Wraps ProjectRepository for reactive CRUD operations.
 * Uses immer middleware for immutable state updates.
 * After each CRUD operation, enqueues a sync action via SyncManager.
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Project, CreateProjectInput, UpdateProjectInput } from '@renderflow/shared';
import { ProjectRepository } from '../db/repositories';
import type { GetAllProjectsOptions } from '../db/repositories';
import { AppError } from '../errors/AppError';
import { SyncManager } from '../sync/SyncManager';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface ProjectState {
    projects: Project[];
    selectedProjectId: string | null;
    searchQuery: string;
    isLoading: boolean;
    error: AppError | null;
}

interface ProjectActions {
    loadProjects: (opts?: GetAllProjectsOptions) => Promise<void>;
    createProject: (input: CreateProjectInput) => Promise<Project>;
    updateProject: (id: string, input: UpdateProjectInput) => Promise<Project>;
    deleteProject: (id: string) => Promise<void>;
    duplicateProject: (id: string) => Promise<Project>;
    toggleFavorite: (id: string) => Promise<Project>;
    selectProject: (id: string | null) => void;
    setSearchQuery: (query: string) => void;
    getProjectById: (id: string) => Project | undefined;
    clearError: () => void;
}

export type ProjectStore = ProjectState & ProjectActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useProjectStore = create<ProjectStore>()(
    immer((set, get) => ({
        // State
        projects: [],
        selectedProjectId: null,
        searchQuery: '',
        isLoading: false,
        error: null,

        // Actions
        loadProjects: async (opts?: GetAllProjectsOptions) => {
            set((state) => {
                state.isLoading = true;
                state.error = null;
            });

            try {
                const searchQuery = get().searchQuery;
                const finalOpts: GetAllProjectsOptions = {
                    ...opts,
                    search: opts?.search ?? (searchQuery || undefined),
                };
                const projects = await ProjectRepository.getAll(finalOpts);

                set((state) => {
                    state.projects = projects;
                    state.isLoading = false;
                });
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.database('Failed to load projects', error instanceof Error ? error : undefined);

                set((state) => {
                    state.isLoading = false;
                    state.error = appError;
                });
            }
        },

        createProject: async (input: CreateProjectInput) => {
            set((state) => {
                state.error = null;
            });

            try {
                const project = await ProjectRepository.create(input);

                set((state) => {
                    state.projects.unshift(project);
                });

                // Enqueue sync action (non-blocking)
                void SyncManager.trackChange('project', project.id, 'create');

                return project;
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.database('Failed to create project', error instanceof Error ? error : undefined);

                set((state) => {
                    state.error = appError;
                });

                throw appError;
            }
        },

        updateProject: async (id: string, input: UpdateProjectInput) => {
            set((state) => {
                state.error = null;
            });

            try {
                const updated = await ProjectRepository.update(id, input);

                set((state) => {
                    const idx = state.projects.findIndex((p) => p.id === id);
                    if (idx !== -1) {
                        state.projects[idx] = updated;
                    }
                });

                // Enqueue sync action (non-blocking)
                // Skip tracking syncStatus-only updates to avoid infinite loops
                const isSyncStatusOnly =
                    Object.keys(input).length === 1 && input.syncStatus !== undefined;
                if (!isSyncStatusOnly) {
                    void SyncManager.trackChange('project', id, 'update');
                }

                return updated;
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.database('Failed to update project', error instanceof Error ? error : undefined);

                set((state) => {
                    state.error = appError;
                });

                throw appError;
            }
        },

        deleteProject: async (id: string) => {
            set((state) => {
                state.error = null;
            });

            try {
                // Track change BEFORE deletion so we can snapshot the remoteId
                void SyncManager.trackChange('project', id, 'delete');

                await ProjectRepository.delete(id);

                set((state) => {
                    state.projects = state.projects.filter((p) => p.id !== id);
                    if (state.selectedProjectId === id) {
                        state.selectedProjectId = null;
                    }
                });
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.database('Failed to delete project', error instanceof Error ? error : undefined);

                set((state) => {
                    state.error = appError;
                });

                throw appError;
            }
        },

        duplicateProject: async (id: string) => {
            set((state) => {
                state.error = null;
            });

            try {
                const duplicate = await ProjectRepository.duplicate(id);

                set((state) => {
                    state.projects.unshift(duplicate);
                });

                // Enqueue sync action for the new duplicate (non-blocking)
                void SyncManager.trackChange('project', duplicate.id, 'create');

                return duplicate;
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.database('Failed to duplicate project', error instanceof Error ? error : undefined);

                set((state) => {
                    state.error = appError;
                });

                throw appError;
            }
        },

        toggleFavorite: async (id: string) => {
            set((state) => {
                state.error = null;
            });

            try {
                const updated = await ProjectRepository.toggleFavorite(id);

                set((state) => {
                    const idx = state.projects.findIndex((p) => p.id === id);
                    if (idx !== -1) {
                        state.projects[idx] = updated;
                    }
                });

                // Enqueue sync action (non-blocking)
                void SyncManager.trackChange('project', id, 'update');

                return updated;
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.database('Failed to toggle favorite', error instanceof Error ? error : undefined);

                set((state) => {
                    state.error = appError;
                });

                throw appError;
            }
        },

        selectProject: (id: string | null) => {
            set((state) => {
                state.selectedProjectId = id;
            });
        },

        setSearchQuery: (query: string) => {
            set((state) => {
                state.searchQuery = query;
            });
        },

        getProjectById: (id: string) => {
            return get().projects.find((p) => p.id === id);
        },

        clearError: () => {
            set((state) => {
                state.error = null;
            });
        },
    })),
);
