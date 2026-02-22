/**
 * RenderConfirmSheet — confirmation bottom sheet before starting a render.
 *
 * Shows a settings summary, credit cost, and Confirm/Cancel buttons.
 * On confirm, submits a cloud render job via useRenderStore.submitCloudRender.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { spacing, radii } from '../../theme/tokens';
import { AppBottomSheet } from '../AppBottomSheet';
import { useRenderStore } from '../../stores';
import {
    EXPORT_FORMATS,
    QUALITY_PRESETS,
    EXPORT_RESOLUTIONS,
    formatFileSize,
} from './exportSettings';
import type {
    ExportFormat,
    ExportQualityKey,
    ExportResolutionKey,
    CreditEstimate,
} from './exportSettings';
import { AppError } from '../../errors/AppError';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RenderConfirmSheetProps {
    visible: boolean;
    onDismiss: () => void;
    onConfirm: (jobId: string) => void;
    projectId: string;
    /** Server-side code URL from sync (set by export flow) */
    codeUrl?: string;
    format: ExportFormat;
    quality: ExportQualityKey;
    resolution: ExportResolutionKey;
    fps: number;
    durationInFrames: number;
    compositionWidth: number;
    compositionHeight: number;
    outputFilename: string;
    estimate: CreditEstimate;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RenderConfirmSheet({
    visible,
    onDismiss,
    onConfirm,
    projectId,
    codeUrl,
    format,
    quality,
    resolution,
    fps,
    durationInFrames,
    compositionWidth: _compositionWidth,
    compositionHeight: _compositionHeight,
    outputFilename,
    estimate,
    testID = 'render-confirm-sheet',
}: RenderConfirmSheetProps) {
    const theme = useAppTheme();
    const submitCloudRender = useRenderStore((s) => s.submitCloudRender);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = useCallback(async () => {
        setIsSubmitting(true);
        setError(null);

        try {
            const resOption = EXPORT_RESOLUTIONS[resolution];

            const job = await submitCloudRender({
                projectId,
                settings: {
                    width: resOption.width,
                    height: resOption.height,
                    fps,
                    durationInFrames,
                    format,
                },
                codeUrl,
            });

            onConfirm(job.id);
        } catch (err: unknown) {
            const message = AppError.is(err)
                ? err.message
                : 'Failed to submit render job';
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    }, [submitCloudRender, projectId, format, resolution, fps, durationInFrames, codeUrl, onConfirm]);

    return (
        <AppBottomSheet
            visible={visible}
            onDismiss={onDismiss}
            title="Ready to Render?"
            testID={testID}
        >
            {/* Settings Summary */}
            <View
                style={[styles.summaryContainer, { backgroundColor: theme.colors.surfaceVariant }]}
                testID={`${testID}-summary`}
            >
                <SummaryRow
                    label="Format"
                    value={`${EXPORT_FORMATS[format].label} (${EXPORT_FORMATS[format].codec})`}
                />
                <SummaryRow
                    label="Quality"
                    value={QUALITY_PRESETS[quality].label}
                />
                <SummaryRow
                    label="Resolution"
                    value={`${EXPORT_RESOLUTIONS[resolution].label} (${EXPORT_RESOLUTIONS[resolution].width}×${EXPORT_RESOLUTIONS[resolution].height})`}
                />
                <SummaryRow label="Frame Rate" value={`${fps} fps`} />
                <SummaryRow
                    label="Duration"
                    value={`${estimate.durationSeconds.toFixed(1)}s`}
                />
                <SummaryRow
                    label="Est. Size"
                    value={`~${formatFileSize(estimate.estimatedFileSize)}`}
                />
                <SummaryRow label="Output" value={outputFilename} />
            </View>

            {/* Error */}
            {error && (
                <View
                    style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}
                    testID={`${testID}-error`}
                >
                    <Icon source="alert-circle-outline" size={16} color={theme.colors.error} />
                    <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.error, flex: 1, marginLeft: spacing.sm }}
                    >
                        {error}
                    </Text>
                </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
                <Button
                    mode="outlined"
                    onPress={onDismiss}
                    disabled={isSubmitting}
                    style={styles.actionButton}
                    testID={`${testID}-cancel`}
                >
                    Cancel
                </Button>
                <Button
                    mode="contained"
                    icon="rocket-launch-outline"
                    onPress={handleConfirm}
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    style={styles.actionButton}
                    testID={`${testID}-confirm`}
                >
                    {isSubmitting ? 'Queuing…' : 'Confirm Render'}
                </Button>
            </View>
        </AppBottomSheet>
    );
}

// ---------------------------------------------------------------------------
// SummaryRow
// ---------------------------------------------------------------------------

function SummaryRow({ label, value }: { label: string; value: string }) {
    const theme = useAppTheme();
    return (
        <View style={styles.summaryRow}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {label}
            </Text>
            <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurface, fontWeight: '600' }}
                numberOfLines={1}
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
    summaryContainer: {
        borderRadius: radii.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    creditBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: radii.md,
        marginBottom: spacing.md,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.sm,
        borderRadius: radii.md,
        marginBottom: spacing.md,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    actionButton: {
        flex: 1,
    },
});
