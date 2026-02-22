/**
 * RenderDetailSheet — Bottom sheet showing full render job details.
 *
 * Appears on tap of a RenderJobCard. Shows complete info and actions
 * based on job status: download/share/delete for completed, retry/delete
 * for failed, cancel for active.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import {
    Modal,
    Portal,
    Text,
    Button,
    Divider,
    Surface,
    IconButton,
} from 'react-native-paper';
import type { RenderJob } from '@renderflow/shared';
import { useAppTheme } from '../theme';
import { spacing, radii } from '../theme/tokens';
import { ConfirmDialog } from './ConfirmDialog';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RenderDetailSheetProps {
    visible: boolean;
    job: RenderJob | null;
    onDismiss: () => void;
    onCancel?: (job: RenderJob) => void;
    onRetry?: (job: RenderJob) => void;
    onDownload?: (job: RenderJob) => void;
    onShare?: (job: RenderJob) => void;
    onDelete?: (job: RenderJob) => void;
    onRerender?: (job: RenderJob) => void;
    onViewProject?: (projectId: string) => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFullDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
    if (!startedAt || !completedAt) return '—';
    const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    const totalSeconds = Math.round(ms / 1000);

    if (totalSeconds < 60) return `${totalSeconds} seconds`;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
}

function getStatusLabel(status: string): string {
    switch (status) {
        case 'queued': return 'Queued';
        case 'processing': return 'Rendering';
        case 'encoding': return 'Encoding';
        case 'completed': return 'Completed';
        case 'failed': return 'Failed';
        default: return status;
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RenderDetailSheet({
    visible,
    job,
    onDismiss,
    onCancel,
    onRetry,
    onDownload,
    onShare,
    onDelete,
    onRerender,
    onViewProject,
    testID = 'render-detail-sheet',
}: RenderDetailSheetProps) {
    const theme = useAppTheme();
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

    const isActive = useMemo(
        () => job?.status === 'queued' || job?.status === 'processing' || job?.status === 'encoding',
        [job?.status],
    );

    const handleDelete = useCallback(() => {
        setDeleteConfirmVisible(true);
    }, []);

    const handleConfirmDelete = useCallback(() => {
        if (job) {
            onDelete?.(job);
            setDeleteConfirmVisible(false);
            onDismiss();
        }
    }, [job, onDelete, onDismiss]);

    const handleCancelDelete = useCallback(() => {
        setDeleteConfirmVisible(false);
    }, []);

    if (!job) return null;

    return (
        <>
            <Portal>
                <Modal
                    visible={visible}
                    onDismiss={onDismiss}
                    contentContainerStyle={[
                        styles.modal,
                        { backgroundColor: theme.colors.surface },
                    ]}
                    testID={testID}
                >
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text variant="titleLarge" style={styles.title}>
                                Render Details
                            </Text>
                            <IconButton
                                icon="close"
                                size={24}
                                onPress={onDismiss}
                                testID={`${testID}-close`}
                            />
                        </View>

                        {/* Status */}
                        <InfoRow
                            label="Status"
                            value={getStatusLabel(job.status)}
                            valueColor={
                                job.status === 'completed'
                                    ? theme.colors.tertiary ?? '#00B894'
                                    : job.status === 'failed'
                                        ? theme.colors.error
                                        : theme.colors.onSurface
                            }
                        />

                        <Divider style={styles.divider} />

                        {/* Settings */}
                        <Text
                            variant="titleSmall"
                            style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
                        >
                            Settings
                        </Text>
                        <InfoRow label="Format" value={job.format.toUpperCase()} />
                        <InfoRow label="Resolution" value={job.resolution} />
                        <InfoRow label="FPS" value={`${job.fps}`} />
                        <InfoRow label="Quality" value={`${job.quality}%`} />
                        <InfoRow label="Total Frames" value={`${job.totalFrames}`} />

                        <Divider style={styles.divider} />

                        {/* Timing */}
                        <Text
                            variant="titleSmall"
                            style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
                        >
                            Timing
                        </Text>
                        <InfoRow label="Created" value={formatFullDate(job.createdAt)} />
                        <InfoRow label="Started" value={formatFullDate(job.startedAt)} />
                        <InfoRow label="Completed" value={formatFullDate(job.completedAt)} />
                        <InfoRow
                            label="Duration"
                            value={formatDuration(job.startedAt, job.completedAt)}
                        />

                        {/* Progress (active jobs) */}
                        {isActive && (
                            <>
                                <Divider style={styles.divider} />
                                <InfoRow
                                    label="Progress"
                                    value={`${Math.round(job.progress)}% (${job.currentFrame}/${job.totalFrames})`}
                                />
                            </>
                        )}

                        {/* Error message (failed jobs) */}
                        {job.status === 'failed' && job.errorMessage && (
                            <>
                                <Divider style={styles.divider} />
                                <Text
                                    variant="titleSmall"
                                    style={[styles.sectionTitle, { color: theme.colors.error }]}
                                >
                                    Error
                                </Text>
                                <Surface
                                    style={[
                                        styles.errorBox,
                                        { backgroundColor: `${theme.colors.error}12` },
                                    ]}
                                    elevation={0}
                                >
                                    <Text
                                        variant="bodySmall"
                                        style={{ color: theme.colors.error }}
                                        testID={`${testID}-error-message`}
                                    >
                                        {job.errorMessage}
                                    </Text>
                                </Surface>
                            </>
                        )}

                        <Divider style={styles.divider} />

                        {/* Actions */}
                        <View style={styles.actions}>
                            {/* Completed actions */}
                            {job.status === 'completed' && (
                                <>
                                    {onDownload && (
                                        <Button
                                            mode="contained"
                                            icon="download"
                                            onPress={() => onDownload(job)}
                                            style={styles.actionButton}
                                            testID={`${testID}-download`}
                                        >
                                            Download
                                        </Button>
                                    )}
                                    {onShare && (
                                        <Button
                                            mode="outlined"
                                            icon="share-variant"
                                            onPress={() => onShare(job)}
                                            style={styles.actionButton}
                                            testID={`${testID}-share`}
                                        >
                                            Share
                                        </Button>
                                    )}
                                    {onRerender && (
                                        <Button
                                            mode="outlined"
                                            icon="refresh"
                                            onPress={() => onRerender(job)}
                                            style={styles.actionButton}
                                            testID={`${testID}-rerender`}
                                        >
                                            Re-render
                                        </Button>
                                    )}
                                </>
                            )}

                            {/* Failed actions */}
                            {job.status === 'failed' && (
                                <>
                                    {onRetry && (
                                        <Button
                                            mode="contained"
                                            icon="refresh"
                                            onPress={() => onRetry(job)}
                                            style={styles.actionButton}
                                            testID={`${testID}-retry`}
                                        >
                                            Retry
                                        </Button>
                                    )}
                                    {onViewProject && (
                                        <Button
                                            mode="outlined"
                                            icon="open-in-new"
                                            onPress={() => onViewProject(job.projectId)}
                                            style={styles.actionButton}
                                            testID={`${testID}-view-project`}
                                        >
                                            View Project
                                        </Button>
                                    )}
                                </>
                            )}

                            {/* Active: cancel */}
                            {isActive && onCancel && (
                                <Button
                                    mode="outlined"
                                    icon="close-circle-outline"
                                    textColor={theme.colors.error}
                                    onPress={() => onCancel(job)}
                                    style={styles.actionButton}
                                    testID={`${testID}-cancel`}
                                >
                                    Cancel Render
                                </Button>
                            )}

                            {/* Delete (all states except active) */}
                            {!isActive && onDelete && (
                                <Button
                                    mode="text"
                                    icon="delete-outline"
                                    textColor={theme.colors.error}
                                    onPress={handleDelete}
                                    style={styles.actionButton}
                                    testID={`${testID}-delete`}
                                >
                                    Delete
                                </Button>
                            )}
                        </View>
                    </ScrollView>
                </Modal>
            </Portal>

            <ConfirmDialog
                visible={deleteConfirmVisible}
                title="Delete Render"
                message="This will permanently delete this render job and any cached video. This cannot be undone."
                confirmLabel="Delete"
                destructive
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                testID={`${testID}-delete-confirm`}
            />
        </>
    );
}

// ---------------------------------------------------------------------------
// InfoRow helper
// ---------------------------------------------------------------------------

function InfoRow({
    label,
    value,
    valueColor,
}: {
    label: string;
    value: string;
    valueColor?: string;
}) {
    const theme = useAppTheme();

    return (
        <View style={styles.infoRow}>
            <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}
            >
                {label}
            </Text>
            <Text
                variant="bodySmall"
                style={{
                    color: valueColor ?? theme.colors.onSurface,
                    fontWeight: '500',
                    flex: 2,
                    textAlign: 'right',
                }}
            >
                {value}
            </Text>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    modal: {
        margin: spacing.lg,
        borderRadius: radii.lg,
        maxHeight: '85%',
        padding: spacing.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    title: {
        fontWeight: '700',
    },
    sectionTitle: {
        fontWeight: '600',
        marginBottom: spacing.sm,
    },
    divider: {
        marginVertical: spacing.md,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    errorBox: {
        padding: spacing.md,
        borderRadius: radii.sm,
    },
    actions: {
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    actionButton: {
        borderRadius: radii.sm,
    },
});
