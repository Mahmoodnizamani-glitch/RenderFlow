/**
 * Render Progress Screen — displays real-time cloud render progress.
 *
 * Shows animated progress ring (Reanimated), stage indicator, frame counter,
 * ETA, and cancel button while rendering. On completion, shows video preview
 * with play/share/save/re-render actions.
 *
 * Route: /render/[id]
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { Button, Icon, IconButton, Surface, Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    Easing,
    interpolate,
    withRepeat,
    withSequence,
} from 'react-native-reanimated';
import { useAppTheme } from '../../src/theme';
import { spacing, radii } from '../../src/theme/tokens';
import { useRenderStore } from '../../src/stores';
import type { RenderJob } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RenderStage = 'fetching' | 'preparing' | 'bundling' | 'rendering' | 'uploading';

const STAGE_LABELS: Record<RenderStage, string> = {
    fetching: 'Fetching Code',
    preparing: 'Preparing Assets',
    bundling: 'Bundling',
    rendering: 'Rendering Frames',
    uploading: 'Uploading Output',
};

const STAGE_ICONS: Record<RenderStage, string> = {
    fetching: 'cloud-download-outline',
    preparing: 'package-variant-closed',
    bundling: 'cube-outline',
    rendering: 'movie-open-outline',
    uploading: 'cloud-upload-outline',
};

const STAGE_ORDER: readonly RenderStage[] = [
    'fetching',
    'preparing',
    'bundling',
    'rendering',
    'uploading',
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RenderProgressScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const theme = useAppTheme();

    // Store selectors
    const activeJobs = useRenderStore((s) => s.activeJobs);
    const jobHistory = useRenderStore((s) => s.jobHistory);
    const cancelCloudRender = useRenderStore((s) => s.cancelCloudRender);
    const getDownloadUrl = useRenderStore((s) => s.getDownloadUrl);

    // Find the job from active or history
    const job: RenderJob | undefined = useMemo(() => {
        return (
            activeJobs.find((j) => j.id === id || j.remoteJobId === id) ??
            jobHistory.find((j) => j.id === id || j.remoteJobId === id)
        );
    }, [activeJobs, jobHistory, id]);

    // Derived state
    const isActive = job?.status === 'queued' || job?.status === 'processing' || job?.status === 'encoding';
    const isCompleted = job?.status === 'completed';
    const isFailed = job?.status === 'failed';

    // Local state
    const [currentStage, _setCurrentStage] = useState<RenderStage>('fetching');
    const [isCancelling, setIsCancelling] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // Animations
    const progressAnim = useSharedValue(0);
    const pulseAnim = useSharedValue(0);

    // Animate progress changes
    useEffect(() => {
        const target = (job?.progress ?? 0) / 100;
        progressAnim.value = withTiming(target, {
            duration: 500,
            easing: Easing.out(Easing.cubic),
        });
    }, [job?.progress, progressAnim]);

    // Pulse animation for active state
    useEffect(() => {
        if (isActive) {
            pulseAnim.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
                    withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
                ),
                -1,
            );
        } else {
            pulseAnim.value = withTiming(0, { duration: 300 });
        }
    }, [isActive, pulseAnim]);

    // Animated progress bar style
    const progressBarStyle = useAnimatedStyle(() => ({
        width: `${interpolate(progressAnim.value, [0, 1], [0, 100])}%`,
    }));

    // Animated pulse style
    const pulseStyle = useAnimatedStyle(() => ({
        opacity: interpolate(pulseAnim.value, [0, 1], [0.5, 1]),
    }));

    // ETA calculation
    const eta = useMemo(() => {
        if (!job || !isActive || job.progress <= 0 || !job.startedAt) return null;
        const elapsed = Date.now() - new Date(job.startedAt).getTime();
        const total = (elapsed / job.progress) * 100;
        const remaining = total - elapsed;
        if (remaining <= 0) return null;
        const seconds = Math.ceil(remaining / 1000);
        if (seconds > 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
        if (seconds > 60) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        return `${seconds}s`;
    }, [job, isActive]);

    // -----------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------

    const handleCancel = useCallback(async () => {
        if (!id) return;

        Alert.alert(
            'Cancel Render',
            'Are you sure you want to cancel this render? Credits will be refunded.',
            [
                { text: 'Keep Rendering', style: 'cancel' },
                {
                    text: 'Cancel Render',
                    style: 'destructive',
                    onPress: async () => {
                        setIsCancelling(true);
                        try {
                            await cancelCloudRender(id);
                        } catch {
                            Alert.alert('Error', 'Failed to cancel render. Please try again.');
                        } finally {
                            setIsCancelling(false);
                        }
                    },
                },
            ],
        );
    }, [id, cancelCloudRender]);

    const handleDownloadAndSave = useCallback(async () => {
        if (!id) return;
        setIsDownloading(true);

        try {
            const { downloadUrl } = await getDownloadUrl(id);
            const ext = job?.format ?? 'mp4';
            const localUri = `${FileSystem.cacheDirectory}render_${id}.${ext}`;

            const download = await FileSystem.downloadAsync(downloadUrl, localUri);

            if (Platform.OS === 'ios') {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                if (status === 'granted') {
                    await MediaLibrary.createAssetAsync(download.uri);
                    Alert.alert('Saved', 'Video saved to your photo library.');
                } else {
                    Alert.alert('Permission Required', 'Please grant photo library access to save videos.');
                }
            } else {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                if (status === 'granted') {
                    await MediaLibrary.createAssetAsync(download.uri);
                    Alert.alert('Saved', 'Video saved to your gallery.');
                }
            }
        } catch {
            Alert.alert('Error', 'Failed to download video. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    }, [id, getDownloadUrl, job?.format]);

    const handleShare = useCallback(async () => {
        if (!id) return;

        try {
            const available = await Sharing.isAvailableAsync();
            if (!available) {
                Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
                return;
            }

            const { downloadUrl } = await getDownloadUrl(id);
            const ext = job?.format ?? 'mp4';
            const localUri = `${FileSystem.cacheDirectory}render_${id}.${ext}`;

            await FileSystem.downloadAsync(downloadUrl, localUri);
            await Sharing.shareAsync(localUri, {
                mimeType: `video/${ext}`,
                dialogTitle: 'Share Rendered Video',
            });
        } catch {
            Alert.alert('Error', 'Failed to share video. Please try again.');
        }
    }, [id, getDownloadUrl, job?.format]);

    const handleBackToProject = useCallback(() => {
        if (job) {
            router.replace(`/project/${job.projectId}`);
        } else {
            router.back();
        }
    }, [router, job]);

    // -----------------------------------------------------------------
    // Not found state
    // -----------------------------------------------------------------

    if (!job) {
        return (
            <>
                <Stack.Screen options={{ title: 'Render', headerShown: true }} />
                <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
                    <Icon source="alert-circle-outline" size={64} color={theme.colors.onSurfaceVariant} />
                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: spacing.md }}>
                        Render Not Found
                    </Text>
                    <Button mode="outlined" onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
                        Go Back
                    </Button>
                </View>
            </>
        );
    }

    // -----------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------

    return (
        <>
            <Stack.Screen
                options={{
                    title: isCompleted ? 'Render Complete' : isFailed ? 'Render Failed' : 'Rendering…',
                    headerShown: true,
                    headerLeft: () => (
                        <IconButton
                            icon="arrow-left"
                            onPress={handleBackToProject}
                            testID="render-back"
                        />
                    ),
                }}
            />

            <ScrollView
                style={[styles.container, { backgroundColor: theme.colors.background }]}
                contentContainerStyle={styles.content}
            >
                {/* --------------------------------------------------------- */}
                {/* Progress Section                                           */}
                {/* --------------------------------------------------------- */}
                {isActive && (
                    <View testID="render-progress-section">
                        {/* Circular text progress */}
                        <Animated.View style={[styles.progressCircle, pulseStyle]}>
                            <Surface
                                style={[styles.progressRing, { backgroundColor: theme.colors.surfaceVariant }]}
                                elevation={2}
                            >
                                <Text
                                    variant="displaySmall"
                                    style={{ color: theme.colors.primary, fontWeight: '700' }}
                                    testID="render-progress-percentage"
                                >
                                    {Math.round(job.progress)}%
                                </Text>
                                <Text
                                    variant="bodySmall"
                                    style={{ color: theme.colors.onSurfaceVariant }}
                                >
                                    {job.currentFrame} / {job.totalFrames} frames
                                </Text>
                            </Surface>
                        </Animated.View>

                        {/* Progress bar */}
                        <View style={[styles.progressBarBg, { backgroundColor: theme.colors.surfaceVariant }]}>
                            <Animated.View
                                style={[
                                    styles.progressBarFill,
                                    { backgroundColor: theme.colors.primary },
                                    progressBarStyle,
                                ]}
                            />
                        </View>

                        {/* Stage indicator */}
                        <View style={styles.stageContainer} testID="render-stage-container">
                            {STAGE_ORDER.map((stage, idx) => {
                                const stageIdx = STAGE_ORDER.indexOf(currentStage);
                                const isCurrentStage = idx === stageIdx;
                                const isPastStage = idx < stageIdx;
                                const color = isCurrentStage
                                    ? theme.colors.primary
                                    : isPastStage
                                        ? theme.colors.primary
                                        : theme.colors.onSurfaceVariant;
                                const opacity = isCurrentStage ? 1 : isPastStage ? 0.7 : 0.3;

                                return (
                                    <View key={stage} style={[styles.stageItem, { opacity }]}>
                                        <Icon
                                            source={isPastStage ? 'check-circle' : STAGE_ICONS[stage]}
                                            size={20}
                                            color={color}
                                        />
                                        <Text
                                            variant="labelSmall"
                                            style={{ color, marginTop: 2 }}
                                            numberOfLines={1}
                                        >
                                            {STAGE_LABELS[stage]}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>

                        {/* ETA */}
                        {eta && (
                            <Text
                                variant="bodySmall"
                                style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: spacing.sm }}
                                testID="render-eta"
                            >
                                Estimated time remaining: {eta}
                            </Text>
                        )}

                        {/* Cancel button */}
                        <Button
                            mode="outlined"
                            icon="close-circle-outline"
                            onPress={handleCancel}
                            loading={isCancelling}
                            disabled={isCancelling}
                            style={{ marginTop: spacing.xl }}
                            textColor={theme.colors.error}
                            testID="render-cancel"
                        >
                            {isCancelling ? 'Cancelling…' : 'Cancel Render'}
                        </Button>

                        {/* Run in Background hint */}
                        <Text
                            variant="bodySmall"
                            style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: spacing.md }}
                        >
                            You can leave this screen — we'll notify you when it's done.
                        </Text>
                    </View>
                )}

                {/* --------------------------------------------------------- */}
                {/* Completed State                                            */}
                {/* --------------------------------------------------------- */}
                {isCompleted && (
                    <View testID="render-complete-section">
                        {/* Success icon */}
                        <View style={styles.successIcon}>
                            <Icon source="check-circle" size={80} color={theme.colors.primary} />
                        </View>

                        <Text
                            variant="headlineSmall"
                            style={{ color: theme.colors.onSurface, textAlign: 'center', fontWeight: '700' }}
                        >
                            Render Complete!
                        </Text>

                        {/* File info */}
                        <Surface
                            style={[styles.infoCard, { backgroundColor: theme.colors.surfaceVariant }]}
                            elevation={0}
                            testID="render-file-info"
                        >
                            <InfoRow label="Format" value={(job.format ?? 'mp4').toUpperCase()} />
                            <InfoRow label="Resolution" value={job.resolution} />
                            <InfoRow label="FPS" value={`${job.fps}`} />
                            {job.completedAt && job.startedAt && (
                                <InfoRow
                                    label="Render Time"
                                    value={formatDuration(
                                        new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime(),
                                    )}
                                />
                            )}
                        </Surface>

                        {/* Action buttons */}
                        <View style={styles.actions}>
                            <Button
                                mode="contained"
                                icon="download"
                                onPress={handleDownloadAndSave}
                                loading={isDownloading}
                                disabled={isDownloading}
                                style={styles.actionButton}
                                testID="render-download"
                            >
                                Save to Device
                            </Button>
                            <Button
                                mode="outlined"
                                icon="share-variant-outline"
                                onPress={handleShare}
                                style={styles.actionButton}
                                testID="render-share"
                            >
                                Share
                            </Button>
                        </View>

                        <Button
                            mode="text"
                            icon="arrow-left"
                            onPress={handleBackToProject}
                            style={{ marginTop: spacing.md }}
                            testID="render-back-to-project"
                        >
                            Back to Project
                        </Button>
                    </View>
                )}

                {/* --------------------------------------------------------- */}
                {/* Failed State                                               */}
                {/* --------------------------------------------------------- */}
                {isFailed && (
                    <View testID="render-failed-section">
                        <View style={styles.successIcon}>
                            <Icon source="alert-circle" size={80} color={theme.colors.error} />
                        </View>

                        <Text
                            variant="headlineSmall"
                            style={{ color: theme.colors.error, textAlign: 'center', fontWeight: '700' }}
                        >
                            Render Failed
                        </Text>

                        {job.errorMessage && (
                            <Surface
                                style={[styles.infoCard, { backgroundColor: theme.colors.errorContainer }]}
                                elevation={0}
                            >
                                <Text
                                    variant="bodyMedium"
                                    style={{ color: theme.colors.onErrorContainer }}
                                    testID="render-error-message"
                                >
                                    {job.errorMessage}
                                </Text>
                            </Surface>
                        )}

                        <View style={styles.actions}>
                            <Button
                                mode="contained"
                                icon="refresh"
                                onPress={handleBackToProject}
                                style={styles.actionButton}
                                testID="render-retry"
                            >
                                Try Again
                            </Button>
                        </View>
                    </View>
                )}

                {/* --------------------------------------------------------- */}
                {/* Queued State                                                */}
                {/* --------------------------------------------------------- */}
                {job.status === 'queued' && (
                    <View testID="render-queued-section">
                        <View style={styles.successIcon}>
                            <Icon source="clock-outline" size={80} color={theme.colors.onSurfaceVariant} />
                        </View>

                        <Text
                            variant="headlineSmall"
                            style={{ color: theme.colors.onSurface, textAlign: 'center', fontWeight: '700' }}
                        >
                            Queued
                        </Text>

                        <Text
                            variant="bodyMedium"
                            style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: spacing.sm }}
                        >
                            Your render is in the queue and will start shortly.
                        </Text>

                        <Button
                            mode="outlined"
                            icon="close-circle-outline"
                            onPress={handleCancel}
                            loading={isCancelling}
                            disabled={isCancelling}
                            style={{ marginTop: spacing.xl }}
                            textColor={theme.colors.error}
                            testID="render-cancel-queued"
                        >
                            {isCancelling ? 'Cancelling…' : 'Cancel'}
                        </Button>
                    </View>
                )}
            </ScrollView>
        </>
    );
}

// ---------------------------------------------------------------------------
// InfoRow — helper component
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string }) {
    const theme = useAppTheme();
    return (
        <View style={styles.infoRow}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {label}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                {value}
            </Text>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: spacing.xl,
        paddingTop: spacing['2xl'],
    },
    progressCircle: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    progressRing: {
        width: 180,
        height: 180,
        borderRadius: 90,
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressBarBg: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: spacing.lg,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    stageContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    stageItem: {
        alignItems: 'center',
        flex: 1,
    },
    successIcon: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    infoCard: {
        borderRadius: radii.lg,
        padding: spacing.md,
        marginTop: spacing.lg,
        marginBottom: spacing.lg,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    actionButton: {
        flex: 1,
    },
});
