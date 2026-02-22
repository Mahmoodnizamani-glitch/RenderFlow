/**
 * SyncManager — Orchestrates bidirectional sync between local SQLite and cloud API.
 *
 * Responsibilities:
 * - Track local CRUD changes by enqueuing them to the sync queue
 * - Push pending changes to the API (with exponential backoff)
 * - Pull remote changes and upsert locally (with last-write-wins conflict resolution)
 * - Throttle auto-sync to max once per 60 seconds
 * - Skip sync when not authenticated
 */
import { SyncRepository, type ChangeType } from './SyncRepository';
import { ProjectRepository } from '../db/repositories';
import {
    fetchProjects,
    createRemoteProject,
    updateRemoteProject,
    deleteRemoteProject,
    serverToLocal,
    type ServerProject,
} from '../api/projects';
import { getAccessToken } from '../api/secureStorage';
import type { CreateProjectInput, UpdateProjectInput } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYNC_THROTTLE_MS = 60_000; // 1 minute
const BASE_BACKOFF_MS = 1_000;
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let lastSyncTimestamp: number = 0;
let isSyncing = false;
let lastPullDate: Date | null = null;

// Callbacks for UI updates
type SyncStatusCallback = (status: SyncStatus) => void;
let _onStatusChange: SyncStatusCallback | null = null;

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function exponentialBackoff(retryCount: number): number {
    return BASE_BACKOFF_MS * Math.pow(2, retryCount);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function emitStatus(status: SyncStatus): void {
    _onStatusChange?.(status);
}

// ---------------------------------------------------------------------------
// SyncManager
// ---------------------------------------------------------------------------

export const SyncManager = {
    /**
     * Register a callback to receive sync status updates.
     */
    onStatusChange(callback: SyncStatusCallback): void {
        _onStatusChange = callback;
    },

    /**
     * Track a local CRUD change by snapshotting the entity and enqueuing.
     */
    async trackChange(
        entityType: string,
        entityId: string,
        changeType: ChangeType,
    ): Promise<void> {
        let payload = '{}';

        if (changeType !== 'delete') {
            try {
                const project = await ProjectRepository.getById(entityId);
                payload = JSON.stringify(project);
            } catch {
                // Entity may already be deleted; use empty payload
                payload = JSON.stringify({ id: entityId });
            }
        } else {
            // For deletes, we need the remoteId to delete on server
            try {
                const project = await ProjectRepository.getById(entityId);
                payload = JSON.stringify({ id: entityId, remoteId: project.remoteId });
            } catch {
                payload = JSON.stringify({ id: entityId });
            }
        }

        await SyncRepository.enqueue(entityType, entityId, changeType, payload);

        // Update local project's sync status to reflect pending
        if (changeType !== 'delete') {
            try {
                await ProjectRepository.update(entityId, { syncStatus: 'syncing' });
            } catch {
                // Non-critical: UI will still show via sync queue
            }
        }
    },

    /**
     * Push all pending local changes to the API.
     * Processes in FIFO order with exponential backoff on failure.
     */
    async syncPendingChanges(): Promise<void> {
        const isAuthenticated = !!(await getAccessToken());
        if (!isAuthenticated) return;

        const actions = await SyncRepository.getPendingActions();
        if (actions.length === 0) return;

        for (const action of actions) {
            await SyncRepository.markInProgress(action.id);

            try {
                const parsedPayload = JSON.parse(action.payload) as Record<string, unknown>;

                switch (action.changeType) {
                    case 'create': {
                        const createInput = parsedPayload as unknown as CreateProjectInput;
                        const remoteProject = await createRemoteProject(createInput);

                        // Link local project to remote
                        await ProjectRepository.update(action.entityId, {
                            remoteId: remoteProject.id,
                            syncStatus: 'synced',
                        });

                        await SyncRepository.remove(action.id);
                        break;
                    }

                    case 'update': {
                        const remoteId = parsedPayload['remoteId'] as string | null;
                        if (!remoteId) {
                            // Hasn't been created remotely yet — convert to create
                            const createInput = parsedPayload as unknown as CreateProjectInput;
                            const remoteProject = await createRemoteProject(createInput);

                            await ProjectRepository.update(action.entityId, {
                                remoteId: remoteProject.id,
                                syncStatus: 'synced',
                            });
                        } else {
                            const updateInput = parsedPayload as unknown as UpdateProjectInput;
                            await updateRemoteProject(remoteId, updateInput);

                            await ProjectRepository.update(action.entityId, {
                                syncStatus: 'synced',
                            });
                        }

                        await SyncRepository.remove(action.id);
                        break;
                    }

                    case 'delete': {
                        const remoteId = parsedPayload['remoteId'] as string | null;
                        if (remoteId) {
                            try {
                                await deleteRemoteProject(remoteId);
                            } catch (deleteErr: unknown) {
                                // 404 means already deleted — that's fine
                                const status = (deleteErr as { response?: { status?: number } })
                                    ?.response?.status;
                                if (status !== 404) throw deleteErr;
                            }
                        }
                        // If no remoteId, the project was never synced — just remove the action
                        await SyncRepository.remove(action.id);
                        break;
                    }
                }
            } catch (error: unknown) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);

                const retryCount = await SyncRepository.incrementRetry(action.id);

                if (retryCount >= MAX_RETRIES) {
                    // Already marked as conflict by incrementRetry
                    try {
                        await ProjectRepository.update(action.entityId, {
                            syncStatus: 'conflict',
                        });
                    } catch {
                        // Project may be deleted
                    }
                } else {
                    // Wait with backoff before next action
                    await sleep(exponentialBackoff(retryCount));
                    await SyncRepository.markFailed(action.id, errorMessage);
                }
            }
        }
    },

    /**
     * Pull remote changes since the last pull and upsert locally.
     * Uses last-write-wins conflict resolution based on updatedAt.
     */
    async pullRemoteChanges(): Promise<void> {
        const isAuthenticated = !!(await getAccessToken());
        if (!isAuthenticated) return;

        try {
            const { projects: remoteProjects } = await fetchProjects(1, 1000);

            for (const remote of remoteProjects) {
                await SyncManager.upsertFromRemote(remote);
            }

            lastPullDate = new Date();
        } catch {
            // Pull failures are non-fatal; will retry on next sync
        }
    },

    /**
     * Upsert a single remote project into the local DB.
     * Applies last-write-wins conflict resolution.
     */
    async upsertFromRemote(remote: ServerProject): Promise<void> {
        // Find local project linked to this remote ID
        const allProjects = await ProjectRepository.getAll();
        const localProject = allProjects.find(
            (p) => p.remoteId === remote.id,
        );

        if (!localProject) {
            // New remote project — create locally
            const mapped = serverToLocal(remote);
            try {
                await ProjectRepository.create({
                    name: mapped.name,
                    description: mapped.description,
                    code: mapped.code,
                    compositionWidth: mapped.compositionWidth,
                    compositionHeight: mapped.compositionHeight,
                    fps: mapped.fps,
                    durationInFrames: mapped.durationInFrames,
                    variables: mapped.variables,
                });

                // After creation, update with remoteId and syncStatus
                const created = (await ProjectRepository.getAll()).find(
                    (p) => p.name === mapped.name && p.syncStatus === 'local',
                );
                if (created) {
                    await ProjectRepository.update(created.id, {
                        remoteId: remote.id,
                        syncStatus: 'synced',
                    });
                }
            } catch {
                // Non-critical: will retry on next pull
            }
            return;
        }

        // Check if local has pending sync actions
        const pendingActions = await SyncRepository.getByEntityId(localProject.id);
        const hasPending = pendingActions.some(
            (a) => a.status === 'pending' || a.status === 'in_progress',
        );

        if (hasPending) {
            // Local has pending changes — let those sync first, skip remote update
            return;
        }

        // Conflict resolution: last-write-wins based on updatedAt
        const localUpdated = new Date(localProject.updatedAt).getTime();
        const remoteUpdated = new Date(remote.updatedAt).getTime();

        if (remoteUpdated > localUpdated) {
            // Remote is newer — update local
            const mapped = serverToLocal(remote, localProject);
            await ProjectRepository.update(localProject.id, {
                name: mapped.name,
                description: mapped.description,
                code: mapped.code,
                compositionWidth: mapped.compositionWidth,
                compositionHeight: mapped.compositionHeight,
                fps: mapped.fps,
                durationInFrames: mapped.durationInFrames,
                variables: mapped.variables,
                syncStatus: 'synced',
            });
        }
        // If local is newer or same, keep local (it will be pushed on next sync)
    },

    /**
     * Run a full sync cycle: push pending, then pull remote.
     * Respects the 60-second throttle.
     */
    async runFullSync(): Promise<void> {
        const elapsed = Date.now() - lastSyncTimestamp;
        if (elapsed < SYNC_THROTTLE_MS) return;
        if (isSyncing) return;

        const isAuthenticated = !!(await getAccessToken());
        if (!isAuthenticated) return;

        isSyncing = true;
        lastSyncTimestamp = Date.now();
        emitStatus('syncing');

        try {
            await SyncManager.syncPendingChanges();
            await SyncManager.pullRemoteChanges();
            emitStatus('idle');
        } catch {
            emitStatus('error');
        } finally {
            isSyncing = false;
        }
    },

    /**
     * Force sync immediately, ignoring throttle.
     * Used for manual pull-to-refresh.
     */
    async forceSync(): Promise<void> {
        if (isSyncing) return;

        const isAuthenticated = !!(await getAccessToken());
        if (!isAuthenticated) return;

        isSyncing = true;
        lastSyncTimestamp = Date.now();
        emitStatus('syncing');

        try {
            await SyncManager.syncPendingChanges();
            await SyncManager.pullRemoteChanges();
            emitStatus('idle');
        } catch {
            emitStatus('error');
        } finally {
            isSyncing = false;
        }
    },

    /**
     * Check if sync is currently running.
     */
    isSyncing(): boolean {
        return isSyncing;
    },

    /**
     * Get the last pull date.
     */
    getLastPullDate(): Date | null {
        return lastPullDate;
    },

    /**
     * Reset internal state (for testing or logout).
     */
    reset(): void {
        lastSyncTimestamp = 0;
        isSyncing = false;
        lastPullDate = null;
    },
} as const;
