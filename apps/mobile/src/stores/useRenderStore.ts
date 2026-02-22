/**
 * Zustand store for RenderJob state management.
 *
 * Wraps RenderJobRepository for reactive progress tracking and job history.
 * Integrates with the cloud render API and WebSocket for real-time updates.
 * Provides deleteJob, retryRender, and refreshAll for the Renders tab.
 * Falls back to HTTP polling when WebSocket disconnects.
 *
 * Uses immer middleware for immutable state updates.
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
    RenderJob,
    CreateRenderJobInput,
    RenderJobStatus,
} from '@renderflow/shared';
import { RenderJobRepository } from '../db/repositories';
import { AppError } from '../errors/AppError';
import * as renderApi from '../api/renders';
import * as socket from '../api/socket';
import type {
    RenderProgressPayload,
    RenderCompletedPayload,
    RenderFailedPayload,
    RenderCancelledPayload,
    CreditsUpdatedPayload,
    RenderStartedPayload,
} from '../api/socket';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface RenderState {
    activeJobs: RenderJob[];
    jobHistory: RenderJob[];
    isLoading: boolean;
    isSubmitting: boolean;
    creditBalance: number;
    error: AppError | null;
}

interface RenderActions {
    // Local CRUD (preserved from original store)
    loadActiveJobs: () => Promise<void>;
    loadHistory: (opts?: { limit?: number; offset?: number }) => Promise<void>;
    loadJobsByProject: (projectId: string) => Promise<RenderJob[]>;
    createJob: (input: CreateRenderJobInput) => Promise<RenderJob>;
    updateProgress: (id: string, progress: number, currentFrame: number) => Promise<void>;
    updateStatus: (
        id: string,
        status: RenderJobStatus,
        extra?: Partial<Pick<RenderJob, 'outputUri' | 'remoteJobId' | 'errorMessage' | 'startedAt' | 'completedAt'>>,
    ) => Promise<void>;
    getLatestForProject: (projectId: string) => Promise<RenderJob | null>;
    clearError: () => void;
    deleteJob: (id: string) => Promise<void>;
    retryRender: (jobId: string) => Promise<RenderJob>;
    refreshAll: () => Promise<void>;

    // Cloud integration (new)
    submitCloudRender: (input: renderApi.SubmitRenderInput) => Promise<RenderJob>;
    cancelCloudRender: (jobId: string) => Promise<void>;
    getDownloadUrl: (jobId: string) => Promise<renderApi.DownloadUrlResponse>;

    // WebSocket lifecycle
    connectWebSocket: () => Promise<void>;
    disconnectWebSocket: () => void;

    // Polling fallback
    startPolling: () => void;
    stopPolling: () => void;

    // WebSocket event handlers (called internally)
    handleRenderStarted: (payload: RenderStartedPayload) => void;
    handleRenderProgress: (payload: RenderProgressPayload) => void;
    handleRenderCompleted: (payload: RenderCompletedPayload) => void;
    handleRenderFailed: (payload: RenderFailedPayload) => void;
    handleRenderCancelled: (payload: RenderCancelledPayload) => void;
    handleCreditsUpdated: (payload: CreditsUpdatedPayload) => void;
}

export type RenderStore = RenderState & RenderActions;

// ---------------------------------------------------------------------------
// Active status set
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES = new Set<RenderJobStatus>(['queued', 'processing', 'encoding']);

function isActiveJob(job: RenderJob): boolean {
    return ACTIVE_STATUSES.has(job.status);
}

// ---------------------------------------------------------------------------
// Polling interval ref (module-level to avoid store circularity)
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5_000;
let _pollTimer: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useRenderStore = create<RenderStore>()(
    immer((set, get) => ({
        // State
        activeJobs: [],
        jobHistory: [],
        isLoading: false,
        isSubmitting: false,
        creditBalance: 0,
        error: null,

        // -----------------------------------------------------------------
        // Local CRUD actions (preserved)
        // -----------------------------------------------------------------

        loadActiveJobs: async () => {
            set((state) => {
                state.isLoading = true;
                state.error = null;
            });

            try {
                const allJobs = await RenderJobRepository.getAll();
                const active = allJobs.filter(isActiveJob);

                set((state) => {
                    state.activeJobs = active;
                    state.isLoading = false;
                });
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.database('Failed to load active jobs', error instanceof Error ? error : undefined);

                set((state) => {
                    state.isLoading = false;
                    state.error = appError;
                });
            }
        },

        loadHistory: async (opts) => {
            set((state) => {
                state.isLoading = true;
                state.error = null;
            });

            try {
                const jobs = await RenderJobRepository.getAll({
                    limit: opts?.limit,
                    offset: opts?.offset,
                });

                set((state) => {
                    state.jobHistory = jobs;
                    state.isLoading = false;
                });
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.database('Failed to load job history', error instanceof Error ? error : undefined);

                set((state) => {
                    state.isLoading = false;
                    state.error = appError;
                });
            }
        },

        loadJobsByProject: async (projectId: string) => {
            try {
                return await RenderJobRepository.getByProject(projectId);
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.database('Failed to load project jobs', error instanceof Error ? error : undefined);

                set((state) => {
                    state.error = appError;
                });

                throw appError;
            }
        },

        createJob: async (input: CreateRenderJobInput) => {
            set((state) => {
                state.error = null;
            });

            try {
                const job = await RenderJobRepository.create(input);

                set((state) => {
                    state.activeJobs.unshift(job);
                });

                return job;
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.database('Failed to create render job', error instanceof Error ? error : undefined);

                set((state) => {
                    state.error = appError;
                });

                throw appError;
            }
        },

        updateProgress: async (id: string, progress: number, currentFrame: number) => {
            try {
                const updated = await RenderJobRepository.updateProgress(id, progress, currentFrame);

                set((state) => {
                    const idx = state.activeJobs.findIndex((j) => j.id === id);
                    if (idx !== -1) {
                        state.activeJobs[idx] = updated;
                    }
                });
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.database('Failed to update progress', error instanceof Error ? error : undefined);

                set((state) => {
                    state.error = appError;
                });

                throw appError;
            }
        },

        updateStatus: async (id, status, extra) => {
            try {
                const updated = await RenderJobRepository.updateStatus(id, status, extra);

                set((state) => {
                    if (isActiveJob(updated)) {
                        // Update in active list
                        const idx = state.activeJobs.findIndex((j) => j.id === id);
                        if (idx !== -1) {
                            state.activeJobs[idx] = updated;
                        }
                    } else {
                        // Move from active to history
                        state.activeJobs = state.activeJobs.filter((j) => j.id !== id);
                        state.jobHistory.unshift(updated);
                    }
                });
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.database('Failed to update job status', error instanceof Error ? error : undefined);

                set((state) => {
                    state.error = appError;
                });

                throw appError;
            }
        },

        getLatestForProject: async (projectId: string) => {
            try {
                return await RenderJobRepository.getLatest(projectId);
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.database('Failed to get latest job', error instanceof Error ? error : undefined);

                set((state) => {
                    state.error = appError;
                });

                throw appError;
            }
        },

        clearError: () => {
            set((state) => {
                state.error = null;
            });
        },

        // -----------------------------------------------------------------
        // Cloud API actions
        // -----------------------------------------------------------------

        submitCloudRender: async (input: renderApi.SubmitRenderInput) => {
            set((state) => {
                state.isSubmitting = true;
                state.error = null;
            });

            try {
                // Submit to cloud API
                const cloudJob = await renderApi.submitRender(input);

                // Persist locally for offline access
                const localJob = await RenderJobRepository.create({
                    projectId: cloudJob.projectId,
                    renderType: 'cloud',
                    format: cloudJob.format,
                    quality: cloudJob.quality,
                    resolution: cloudJob.resolution,
                    fps: cloudJob.fps,
                    totalFrames: cloudJob.totalFrames,
                });

                // Update local job with remote ID
                const linkedJob = await RenderJobRepository.updateStatus(
                    localJob.id,
                    'queued',
                    { remoteJobId: cloudJob.id },
                );

                set((state) => {
                    state.activeJobs.unshift(linkedJob);
                    state.isSubmitting = false;
                });

                // Subscribe to real-time updates
                socket.subscribeToJob(cloudJob.id);

                return linkedJob;
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.unknown(
                        'Failed to submit cloud render',
                        error instanceof Error ? error : undefined,
                    );

                set((state) => {
                    state.isSubmitting = false;
                    state.error = appError;
                });

                throw appError;
            }
        },

        cancelCloudRender: async (jobId: string) => {
            try {
                // Find the local job to get the remote ID
                const localJob = get().activeJobs.find(
                    (j) => j.id === jobId || j.remoteJobId === jobId,
                );
                const remoteId = localJob?.remoteJobId ?? jobId;

                // Cancel on server
                await renderApi.cancelRender(remoteId);

                // Update local state
                if (localJob) {
                    const updated = await RenderJobRepository.updateStatus(
                        localJob.id,
                        'failed',
                        {
                            errorMessage: 'Cancelled by user',
                            completedAt: new Date().toISOString(),
                        },
                    );

                    set((state) => {
                        state.activeJobs = state.activeJobs.filter((j) => j.id !== localJob.id);
                        state.jobHistory.unshift(updated);
                    });

                    // Unsubscribe from WS updates
                    socket.unsubscribeFromJob(remoteId);
                }
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.unknown(
                        'Failed to cancel render',
                        error instanceof Error ? error : undefined,
                    );

                set((state) => {
                    state.error = appError;
                });

                throw appError;
            }
        },

        getDownloadUrl: async (jobId: string) => {
            try {
                const localJob = get().jobHistory.find(
                    (j) => j.id === jobId || j.remoteJobId === jobId,
                ) ?? get().activeJobs.find(
                    (j) => j.id === jobId || j.remoteJobId === jobId,
                );
                const remoteId = localJob?.remoteJobId ?? jobId;

                return await renderApi.getDownloadUrl(remoteId);
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.unknown(
                        'Failed to get download URL',
                        error instanceof Error ? error : undefined,
                    );

                set((state) => {
                    state.error = appError;
                });

                throw appError;
            }
        },

        // -----------------------------------------------------------------
        // WebSocket lifecycle
        // -----------------------------------------------------------------

        connectWebSocket: async () => {
            const store = get();

            // Register event handlers before connecting
            socket.onRenderStarted(store.handleRenderStarted);
            socket.onRenderProgress(store.handleRenderProgress);
            socket.onRenderCompleted(store.handleRenderCompleted);
            socket.onRenderFailed(store.handleRenderFailed);
            socket.onRenderCancelled(store.handleRenderCancelled);
            socket.onCreditsUpdated(store.handleCreditsUpdated);

            await socket.connect();

            // Re-subscribe to all active jobs
            for (const job of store.activeJobs) {
                if (job.remoteJobId) {
                    socket.subscribeToJob(job.remoteJobId);
                }
            }
        },

        disconnectWebSocket: () => {
            socket.disconnect();
            get().stopPolling();
        },

        // -----------------------------------------------------------------
        // Polling fallback
        // -----------------------------------------------------------------

        startPolling: () => {
            if (_pollTimer) return;

            _pollTimer = setInterval(async () => {
                const { activeJobs } = get();
                const remoteJobs = activeJobs.filter((j) => j.remoteJobId);

                for (const job of remoteJobs) {
                    try {
                        const updated = await renderApi.getRenderStatus(job.remoteJobId!);
                        const { handleRenderProgress, handleRenderCompleted, handleRenderFailed } = get();

                        if (updated.status === 'completed') {
                            handleRenderCompleted({
                                jobId: job.remoteJobId!,
                                outputUrl: updated.outputUri ?? '',
                                fileSize: 0,
                                duration: 0,
                                completedAt: updated.completedAt ?? new Date().toISOString(),
                            });
                        } else if (updated.status === 'failed') {
                            handleRenderFailed({
                                jobId: job.remoteJobId!,
                                errorMessage: updated.errorMessage ?? 'Render failed',
                                errorType: 'RENDER_ERROR',
                                completedAt: updated.completedAt ?? new Date().toISOString(),
                            });
                        } else if (updated.status === 'processing') {
                            handleRenderProgress({
                                jobId: job.remoteJobId!,
                                currentFrame: updated.currentFrame,
                                totalFrames: updated.totalFrames,
                                percentage: updated.progress,
                                stage: 'rendering',
                            });
                        }
                    } catch {
                        // Silently ignore polling errors — will retry next interval
                    }
                }
            }, POLL_INTERVAL_MS);
        },

        stopPolling: () => {
            if (_pollTimer) {
                clearInterval(_pollTimer);
                _pollTimer = null;
            }
        },

        // -----------------------------------------------------------------
        // WebSocket event handlers
        // -----------------------------------------------------------------

        handleRenderStarted: (payload: RenderStartedPayload) => {
            set((state) => {
                const job = state.activeJobs.find((j) => j.remoteJobId === payload.jobId);
                if (job) {
                    job.status = 'processing';
                    job.startedAt = payload.startedAt;
                }
            });

            // Also persist to local DB (fire-and-forget)
            const localJob = get().activeJobs.find((j) => j.remoteJobId === payload.jobId);
            if (localJob) {
                void RenderJobRepository.updateStatus(localJob.id, 'processing', {
                    startedAt: payload.startedAt,
                });
            }
        },

        handleRenderProgress: (payload: RenderProgressPayload) => {
            set((state) => {
                const job = state.activeJobs.find((j) => j.remoteJobId === payload.jobId);
                if (job) {
                    job.progress = payload.percentage;
                    job.currentFrame = payload.currentFrame;
                    job.totalFrames = payload.totalFrames;
                }
            });

            // Persist to local DB (fire-and-forget, throttled by WS server)
            const localJob = get().activeJobs.find((j) => j.remoteJobId === payload.jobId);
            if (localJob) {
                void RenderJobRepository.updateProgress(
                    localJob.id,
                    payload.percentage,
                    payload.currentFrame,
                );
            }
        },

        handleRenderCompleted: (payload: RenderCompletedPayload) => {
            set((state) => {
                const jobIdx = state.activeJobs.findIndex((j) => j.remoteJobId === payload.jobId);
                if (jobIdx !== -1) {
                    const job = state.activeJobs[jobIdx]!;
                    const completed: RenderJob = {
                        ...job,
                        status: 'completed',
                        progress: 100,
                        outputUri: payload.outputUrl,
                        completedAt: payload.completedAt,
                    };
                    state.activeJobs.splice(jobIdx, 1);
                    state.jobHistory.unshift(completed);
                }
            });

            // Persist and unsubscribe
            const localJob = get().jobHistory.find((j) => j.remoteJobId === payload.jobId);
            if (localJob) {
                void RenderJobRepository.updateStatus(localJob.id, 'completed', {
                    outputUri: payload.outputUrl,
                    completedAt: payload.completedAt,
                });
            }
            socket.unsubscribeFromJob(payload.jobId);
        },

        handleRenderFailed: (payload: RenderFailedPayload) => {
            set((state) => {
                const jobIdx = state.activeJobs.findIndex((j) => j.remoteJobId === payload.jobId);
                if (jobIdx !== -1) {
                    const job = state.activeJobs[jobIdx]!;
                    const failed: RenderJob = {
                        ...job,
                        status: 'failed',
                        errorMessage: payload.errorMessage,
                        completedAt: payload.completedAt,
                    };
                    state.activeJobs.splice(jobIdx, 1);
                    state.jobHistory.unshift(failed);
                }
            });

            // Persist and unsubscribe
            const localJob = get().jobHistory.find((j) => j.remoteJobId === payload.jobId);
            if (localJob) {
                void RenderJobRepository.updateStatus(localJob.id, 'failed', {
                    errorMessage: payload.errorMessage,
                    completedAt: payload.completedAt,
                });
            }
            socket.unsubscribeFromJob(payload.jobId);
        },

        handleRenderCancelled: (payload: RenderCancelledPayload) => {
            set((state) => {
                const jobIdx = state.activeJobs.findIndex((j) => j.remoteJobId === payload.jobId);
                if (jobIdx !== -1) {
                    const job = state.activeJobs[jobIdx]!;
                    const cancelled: RenderJob = {
                        ...job,
                        status: 'failed',
                        errorMessage: 'Cancelled',
                        completedAt: new Date().toISOString(),
                    };
                    state.activeJobs.splice(jobIdx, 1);
                    state.jobHistory.unshift(cancelled);
                }
            });

            const localJob = get().jobHistory.find((j) => j.remoteJobId === payload.jobId);
            if (localJob) {
                void RenderJobRepository.updateStatus(localJob.id, 'failed', {
                    errorMessage: 'Cancelled',
                    completedAt: new Date().toISOString(),
                });
            }
            socket.unsubscribeFromJob(payload.jobId);
        },

        handleCreditsUpdated: (payload: CreditsUpdatedPayload) => {
            set((state) => {
                state.creditBalance = payload.balance;
            });
        },

        // -----------------------------------------------------------------
        // Renders tab actions
        // -----------------------------------------------------------------

        deleteJob: async (id: string) => {
            try {
                // Find the job to check its remoteJobId for cache cleanup
                const job = [...get().activeJobs, ...get().jobHistory].find(
                    (j) => j.id === id,
                );

                // Delete from DB
                await RenderJobRepository.delete(id);

                // Clear cached video if exists
                if (job) {
                    const { clearCachedVideo } = await import('../services/renderCache');
                    await clearCachedVideo(id, job.format || 'mp4');
                }

                // Remove from store
                set((state) => {
                    state.activeJobs = state.activeJobs.filter((j) => j.id !== id);
                    state.jobHistory = state.jobHistory.filter((j) => j.id !== id);
                });
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.unknown(
                        'Failed to delete render job',
                        error instanceof Error ? error : undefined,
                    );
                set((state) => {
                    state.error = appError;
                });
                throw appError;
            }
        },

        retryRender: async (jobId: string) => {
            // Find the original job to reuse settings
            const original = [...get().activeJobs, ...get().jobHistory].find(
                (j) => j.id === jobId,
            );

            if (!original) {
                throw AppError.notFound(`Render job "${jobId}" not found for retry`);
            }

            // Parse resolution back to width/height
            const [widthStr, heightStr] = original.resolution.split('x');
            const width = parseInt(widthStr ?? '1920', 10);
            const height = parseInt(heightStr ?? '1080', 10);

            // Resubmit with same settings
            return get().submitCloudRender({
                projectId: original.projectId,
                settings: {
                    width,
                    height,
                    fps: original.fps,
                    durationInFrames: original.totalFrames,
                    format: (original.format || 'mp4') as 'mp4' | 'webm' | 'gif',
                },
            });
        },

        refreshAll: async () => {
            set((state) => {
                state.isLoading = true;
                state.error = null;
            });

            try {
                const [active, all] = await Promise.all([
                    RenderJobRepository.getAll({ status: undefined, limit: 200 }),
                    RenderJobRepository.getAll({ limit: 200 }),
                ]);

                set((state) => {
                    state.activeJobs = active.filter(isActiveJob);
                    state.jobHistory = all.filter((j) => !isActiveJob(j));
                    state.isLoading = false;
                });
            } catch (error: unknown) {
                const appError = AppError.is(error)
                    ? error
                    : AppError.unknown(
                        'Failed to refresh render jobs',
                        error instanceof Error ? error : undefined,
                    );
                set((state) => {
                    state.isLoading = false;
                    state.error = appError;
                });
            }
        },
    })),
);
