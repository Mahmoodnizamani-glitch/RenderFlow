/**
 * RenderJobCard — Status-aware card for render jobs.
 *
 * Renders distinct UI per render status:
 * - Queued: queue indicator, cancel button
 * - Processing/Encoding: animated progress bar, frame count, ETA, cancel button
 * - Completed: format/resolution badge, date, download/share buttons
 * - Failed: error message preview, retry button
 */
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
    Card,
    Text,
    ProgressBar,
    IconButton,
    TouchableRipple,
} from 'react-native-paper';
import type { RenderJob } from '@renderflow/shared';
import { useAppTheme } from '../theme';
import { spacing, radii } from '../theme/tokens';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RenderJobCardProps {
    job: RenderJob;
    onPress: (job: RenderJob) => void;
    onCancel?: (job: RenderJob) => void;
    onRetry?: (job: RenderJob) => void;
    onDownload?: (job: RenderJob) => void;
    onShare?: (job: RenderJob) => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
    if (!startedAt || !completedAt) return '';
    const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    const totalSeconds = Math.round(ms / 1000);

    if (totalSeconds < 60) return `${totalSeconds}s`;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs}s`;
}

function formatETA(progress: number, startedAt: string | null): string {
    if (!startedAt || progress <= 0 || progress >= 100) return '';
    const elapsed = Date.now() - new Date(startedAt).getTime();
    const estimated = (elapsed / progress) * (100 - progress);
    const secs = Math.round(estimated / 1000);

    if (secs < 60) return `~${secs}s left`;
    const mins = Math.floor(secs / 60);
    return `~${mins}m left`;
}

function getStatusColor(status: string, theme: ReturnType<typeof useAppTheme>): string {
    switch (status) {
        case 'queued':
            return theme.colors.onSurfaceVariant;
        case 'processing':
        case 'encoding':
            return theme.colors.primary;
        case 'completed':
            return theme.colors.tertiary ?? '#00B894';
        case 'failed':
            return theme.colors.error;
        default:
            return theme.colors.onSurfaceVariant;
    }
}

function _getStatusIcon(status: string): string {
    switch (status) {
        case 'queued':
            return 'clock-outline';
        case 'processing':
        case 'encoding':
            return 'loading';
        case 'completed':
            return 'check-circle-outline';
        case 'failed':
            return 'alert-circle-outline';
        default:
            return 'help-circle-outline';
    }
}

function getStatusLabel(status: string): string {
    switch (status) {
        case 'queued':
            return 'Queued';
        case 'processing':
            return 'Rendering';
        case 'encoding':
            return 'Encoding';
        case 'completed':
            return 'Completed';
        case 'failed':
            return 'Failed';
        default:
            return status;
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const RenderJobCard = React.memo(function RenderJobCard({
    job,
    onPress,
    onCancel,
    onRetry,
    onDownload,
    onShare,
    testID,
}: RenderJobCardProps) {
    const theme = useAppTheme();
    const statusColor = useMemo(() => getStatusColor(job.status, theme), [job.status, theme]);
    const isActive = job.status === 'queued' || job.status === 'processing' || job.status === 'encoding';

    const handlePress = useCallback(() => onPress(job), [onPress, job]);
    const handleCancel = useCallback(() => onCancel?.(job), [onCancel, job]);
    const handleRetry = useCallback(() => onRetry?.(job), [onRetry, job]);
    const handleDownload = useCallback(() => onDownload?.(job), [onDownload, job]);
    const handleShare = useCallback(() => onShare?.(job), [onShare, job]);

    return (
        <TouchableRipple
            onPress={handlePress}
            borderless
            style={[styles.touchable, { borderRadius: radii.md }]}
            testID={testID}
        >
            <Card
                style={[
                    styles.card,
                    {
                        backgroundColor: theme.colors.surfaceVariant,
                        borderLeftColor: statusColor,
                    },
                ]}
                mode="contained"
            >
                <View style={styles.content}>
                    {/* Header row: status chip + format badge */}
                    <View style={styles.headerRow}>
                        <View
                            style={[styles.statusChip, { backgroundColor: `${statusColor}18` }]}
                            testID={`${testID}-status`}
                        >
                            <Text style={[styles.statusText, { color: statusColor }]}>
                                {getStatusLabel(job.status)}
                            </Text>
                        </View>

                        <View style={styles.badges}>
                            <Text
                                variant="labelSmall"
                                style={[styles.badge, { color: theme.colors.onSurfaceVariant }]}
                            >
                                {job.format.toUpperCase()} • {job.resolution} • {job.fps}fps
                            </Text>
                        </View>
                    </View>

                    {/* Active: progress bar + frame count + ETA */}
                    {isActive && job.status !== 'queued' && (
                        <View style={styles.progressSection}>
                            <ProgressBar
                                progress={job.progress / 100}
                                color={statusColor}
                                style={styles.progressBar}
                                testID={`${testID}-progress`}
                            />
                            <View style={styles.progressInfo}>
                                <Text
                                    variant="labelSmall"
                                    style={{ color: theme.colors.onSurfaceVariant }}
                                >
                                    {Math.round(job.progress)}% • Frame {job.currentFrame}/{job.totalFrames}
                                </Text>
                                {job.startedAt && (
                                    <Text
                                        variant="labelSmall"
                                        style={{ color: theme.colors.onSurfaceVariant }}
                                    >
                                        {formatETA(job.progress, job.startedAt)}
                                    </Text>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Queued: waiting indicator */}
                    {job.status === 'queued' && (
                        <View style={styles.queuedRow}>
                            <Text
                                variant="bodySmall"
                                style={{ color: theme.colors.onSurfaceVariant }}
                            >
                                Waiting in queue…
                            </Text>
                        </View>
                    )}

                    {/* Completed: date + duration */}
                    {job.status === 'completed' && (
                        <View style={styles.completedRow}>
                            <Text
                                variant="labelSmall"
                                style={{ color: theme.colors.onSurfaceVariant }}
                            >
                                {formatDate(job.completedAt)}
                            </Text>
                            {job.startedAt && job.completedAt && (
                                <Text
                                    variant="labelSmall"
                                    style={{ color: theme.colors.onSurfaceVariant }}
                                >
                                    Duration: {formatDuration(job.startedAt, job.completedAt)}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Failed: error preview */}
                    {job.status === 'failed' && (
                        <View style={styles.failedRow}>
                            <Text
                                variant="bodySmall"
                                style={{ color: theme.colors.error }}
                                numberOfLines={2}
                            >
                                {job.errorMessage || 'Render failed — tap for details'}
                            </Text>
                        </View>
                    )}

                    {/* Action buttons */}
                    <View style={styles.actionsRow}>
                        {/* Active jobs: cancel */}
                        {isActive && onCancel && (
                            <IconButton
                                icon="close-circle-outline"
                                iconColor={theme.colors.error}
                                size={20}
                                onPress={handleCancel}
                                testID={`${testID}-cancel`}
                                accessibilityLabel="Cancel render"
                            />
                        )}

                        {/* Completed jobs: download + share */}
                        {job.status === 'completed' && (
                            <>
                                {onDownload && (
                                    <IconButton
                                        icon="download"
                                        iconColor={theme.colors.primary}
                                        size={20}
                                        onPress={handleDownload}
                                        testID={`${testID}-download`}
                                        accessibilityLabel="Download video"
                                    />
                                )}
                                {onShare && (
                                    <IconButton
                                        icon="share-variant"
                                        iconColor={theme.colors.primary}
                                        size={20}
                                        onPress={handleShare}
                                        testID={`${testID}-share`}
                                        accessibilityLabel="Share video"
                                    />
                                )}
                            </>
                        )}

                        {/* Failed jobs: retry */}
                        {job.status === 'failed' && onRetry && (
                            <IconButton
                                icon="refresh"
                                iconColor={theme.colors.primary}
                                size={20}
                                onPress={handleRetry}
                                testID={`${testID}-retry`}
                                accessibilityLabel="Retry render"
                            />
                        )}

                        {/* Date stamp */}
                        <View style={styles.spacer} />
                        <Text
                            variant="labelSmall"
                            style={[styles.dateStamp, { color: theme.colors.onSurfaceVariant }]}
                        >
                            {formatDate(job.createdAt)}
                        </Text>
                    </View>
                </View>
            </Card>
        </TouchableRipple>
    );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    touchable: {
        marginBottom: spacing.sm,
    },
    card: {
        borderRadius: radii.md,
        borderLeftWidth: 4,
        overflow: 'hidden',
    },
    content: {
        padding: spacing.md,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    statusChip: {
        borderRadius: radii.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    badges: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    badge: {
        fontSize: 11,
        fontWeight: '500',
    },
    progressSection: {
        marginBottom: spacing.sm,
    },
    progressBar: {
        height: 6,
        borderRadius: 3,
        marginBottom: spacing.xs,
    },
    progressInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    queuedRow: {
        marginBottom: spacing.sm,
    },
    completedRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    failedRow: {
        marginBottom: spacing.sm,
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    spacer: {
        flex: 1,
    },
    dateStamp: {
        fontWeight: '400',
    },
});
