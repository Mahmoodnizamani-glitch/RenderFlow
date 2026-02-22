/**
 * SyncRepository — SQLite CRUD for the pending sync actions queue.
 *
 * Each action represents a local change (create/update/delete) that
 * needs to be pushed to the cloud API. Actions persist across app
 * restarts and are processed by SyncManager.
 */
import { eq, and, asc } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { getDb } from '../db/client';
import { pendingSyncActions } from '../db/schema';
import { AppError } from '../errors/AppError';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChangeType = 'create' | 'update' | 'delete';
export type SyncActionStatus = 'pending' | 'in_progress' | 'failed' | 'conflict';

export interface PendingSyncAction {
    id: string;
    entityType: string;
    entityId: string;
    changeType: ChangeType;
    payload: string;
    retryCount: number;
    status: SyncActionStatus;
    errorMessage: string | null;
    createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;

function now(): string {
    return new Date().toISOString();
}

function toSyncAction(row: typeof pendingSyncActions.$inferSelect): PendingSyncAction {
    return {
        id: row.id,
        entityType: row.entityType,
        entityId: row.entityId,
        changeType: row.changeType as ChangeType,
        payload: row.payload,
        retryCount: row.retryCount,
        status: row.status as SyncActionStatus,
        errorMessage: row.errorMessage,
        createdAt: row.createdAt,
    };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const SyncRepository = {
    /**
     * Enqueue a sync action. If an action for the same entity already exists
     * with status 'pending', it is replaced (dedup) with the new payload.
     * For deletes, any existing pending create/update is removed and replaced.
     */
    async enqueue(
        entityType: string,
        entityId: string,
        changeType: ChangeType,
        payload: string,
    ): Promise<PendingSyncAction> {
        const db = getDb();

        try {
            // Check for existing pending action for same entity
            const existing = await db
                .select()
                .from(pendingSyncActions)
                .where(
                    and(
                        eq(pendingSyncActions.entityType, entityType),
                        eq(pendingSyncActions.entityId, entityId),
                        eq(pendingSyncActions.status, 'pending'),
                    ),
                )
                .limit(1);

            if (existing.length > 0) {
                const existingAction = existing[0]!;

                // If deleting and there was a pending create, just remove both
                // (the entity was never pushed to the server)
                if (changeType === 'delete' && existingAction.changeType === 'create') {
                    await db
                        .delete(pendingSyncActions)
                        .where(eq(pendingSyncActions.id, existingAction.id));
                    // Return a synthetic action for the caller
                    return {
                        id: existingAction.id,
                        entityType,
                        entityId,
                        changeType: 'delete',
                        payload,
                        retryCount: 0,
                        status: 'pending',
                        errorMessage: null,
                        createdAt: existingAction.createdAt,
                    };
                }

                // Otherwise update the existing action with new payload/type
                await db
                    .update(pendingSyncActions)
                    .set({
                        changeType,
                        payload,
                        retryCount: 0,
                        errorMessage: null,
                    })
                    .where(eq(pendingSyncActions.id, existingAction.id));

                return toSyncAction({
                    ...existingAction,
                    changeType,
                    payload,
                    retryCount: 0,
                    errorMessage: null,
                });
            }

            // No existing action — insert new
            const id = randomUUID();
            const values = {
                id,
                entityType,
                entityId,
                changeType,
                payload,
                retryCount: 0,
                status: 'pending' as const,
                errorMessage: null,
                createdAt: now(),
            };

            await db.insert(pendingSyncActions).values(values);
            return toSyncAction(values);
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                `Failed to enqueue sync action for ${entityType}:${entityId}`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    /**
     * Get all pending actions ordered by creation time (FIFO).
     */
    async getPendingActions(): Promise<PendingSyncAction[]> {
        const db = getDb();

        try {
            const rows = await db
                .select()
                .from(pendingSyncActions)
                .where(eq(pendingSyncActions.status, 'pending'))
                .orderBy(asc(pendingSyncActions.createdAt));

            return rows.map(toSyncAction);
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                'Failed to fetch pending sync actions',
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    /**
     * Mark an action as in-progress (being synced).
     */
    async markInProgress(id: string): Promise<void> {
        const db = getDb();
        await db
            .update(pendingSyncActions)
            .set({ status: 'in_progress' })
            .where(eq(pendingSyncActions.id, id));
    },

    /**
     * Mark an action as failed with an error message.
     */
    async markFailed(id: string, errorMessage: string): Promise<void> {
        const db = getDb();
        await db
            .update(pendingSyncActions)
            .set({ status: 'failed', errorMessage })
            .where(eq(pendingSyncActions.id, id));
    },

    /**
     * Mark an action as conflict (unresolvable after max retries).
     */
    async markConflict(id: string, errorMessage: string): Promise<void> {
        const db = getDb();
        await db
            .update(pendingSyncActions)
            .set({ status: 'conflict', errorMessage })
            .where(eq(pendingSyncActions.id, id));
    },

    /**
     * Remove a completed sync action from the queue.
     */
    async remove(id: string): Promise<void> {
        const db = getDb();
        await db
            .delete(pendingSyncActions)
            .where(eq(pendingSyncActions.id, id));
    },

    /**
     * Get pending/failed actions for a specific entity.
     */
    async getByEntityId(entityId: string): Promise<PendingSyncAction[]> {
        const db = getDb();

        const rows = await db
            .select()
            .from(pendingSyncActions)
            .where(eq(pendingSyncActions.entityId, entityId));

        return rows.map(toSyncAction);
    },

    /**
     * Increment retry count. If max retries exceeded, mark as conflict.
     * Returns the new retry count.
     */
    async incrementRetry(id: string): Promise<number> {
        const db = getDb();

        const rows = await db
            .select()
            .from(pendingSyncActions)
            .where(eq(pendingSyncActions.id, id))
            .limit(1);

        const action = rows[0];
        if (!action) return 0;

        const newCount = action.retryCount + 1;

        if (newCount >= MAX_RETRIES) {
            await db
                .update(pendingSyncActions)
                .set({
                    retryCount: newCount,
                    status: 'conflict',
                    errorMessage: `Max retries (${MAX_RETRIES}) exceeded`,
                })
                .where(eq(pendingSyncActions.id, id));
        } else {
            await db
                .update(pendingSyncActions)
                .set({
                    retryCount: newCount,
                    status: 'pending',
                })
                .where(eq(pendingSyncActions.id, id));
        }

        return newCount;
    },

    /**
     * Get count of all pending/in_progress actions.
     */
    async getPendingCount(): Promise<number> {
        const db = getDb();
        const rows = await db
            .select()
            .from(pendingSyncActions)
            .where(eq(pendingSyncActions.status, 'pending'));
        return rows.length;
    },

    /**
     * Clear all sync actions. Used on logout or testing.
     */
    async clearAll(): Promise<void> {
        const db = getDb();
        await db.delete(pendingSyncActions);
    },
} as const;
