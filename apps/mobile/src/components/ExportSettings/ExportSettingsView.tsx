/**
 * ExportSettings — the Export tab UI for configuring render settings.
 *
 * Renders format, quality, resolution, fps selectors, output filename,
 * cost estimate, and the Start Render button.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
    Button,
    Chip,
    Divider,
    Icon,
    Surface,
    Text,
    TextInput,
} from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { spacing, radii } from '../../theme/tokens';
import {
    EXPORT_FORMATS,
    FORMAT_KEYS,
    DEFAULT_FORMAT,
    QUALITY_PRESETS,
    QUALITY_KEYS,
    DEFAULT_QUALITY,
    EXPORT_RESOLUTIONS,
    DEFAULT_RESOLUTION,
    FPS_OPTIONS,
    DEFAULT_FPS,
    DEFAULT_RENDER_METHOD,
    calculateCreditEstimate,
    formatFileSize,
    generateOutputFilename,
    getAvailableResolutions,
} from './exportSettings';
import type {
    ExportFormat,
    ExportQualityKey,
    ExportResolutionKey,
    ExportFps,
    RenderMethod,
} from './exportSettings';
import { RenderConfirmSheet } from './RenderConfirmSheet';
import { useRenderStore } from '../../stores';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportSettingsProps {
    /** Project ID */
    projectId: string;
    /** Project name — used for default output filename */
    projectName: string;
    /** Current code — needed to detect if composition exists */
    code: string;
    /** Composition width from project settings */
    compositionWidth: number;
    /** Composition height from project settings */
    compositionHeight: number;
    /** Composition fps */
    fps: number;
    /** Composition duration in frames */
    durationInFrames: number;
    /** Server-side code URL from sync (set by export flow) */
    codeUrl?: string;
    /** Called after a render job has been successfully created */
    onRenderQueued?: (jobId: string) => void;
    /** Test ID */
    testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExportSettings({
    projectId,
    projectName,
    code,
    compositionWidth,
    compositionHeight,
    fps: compositionFps,
    durationInFrames,
    codeUrl,
    onRenderQueued,
    testID = 'export-settings',
}: ExportSettingsProps) {
    const theme = useAppTheme();
    const creditBalance = useRenderStore((s) => s.creditBalance);

    // Settings state
    const [format, setFormat] = useState<ExportFormat>(DEFAULT_FORMAT);
    const [quality, setQuality] = useState<ExportQualityKey>(DEFAULT_QUALITY);
    const [resolution, setResolution] = useState<ExportResolutionKey>(DEFAULT_RESOLUTION);
    const [renderFps, setRenderFps] = useState<ExportFps>(DEFAULT_FPS);
    const [renderMethod] = useState<RenderMethod>(DEFAULT_RENDER_METHOD);
    const [outputFilename, setOutputFilename] = useState('');
    const [confirmVisible, setConfirmVisible] = useState(false);

    // Generate default filename on mount / format change
    useEffect(() => {
        setOutputFilename(generateOutputFilename(projectName, format));
    }, [projectName, format]);

    // Available resolutions (GIF caps at 1080p)
    const availableResolutions = useMemo(() => getAvailableResolutions(format), [format]);

    // Clamp resolution when switching formats
    useEffect(() => {
        if (!availableResolutions.includes(resolution)) {
            const maxAvailable = availableResolutions[availableResolutions.length - 1];
            if (maxAvailable) setResolution(maxAvailable);
        }
    }, [availableResolutions, resolution]);

    // Credit estimate
    const estimate = useMemo(
        () =>
            calculateCreditEstimate({
                durationInFrames,
                fps: format === 'gif' ? compositionFps : renderFps,
                format,
                quality,
                resolution,
            }),
        [durationInFrames, compositionFps, renderFps, format, quality, resolution],
    );

    // Composition detection
    const hasComposition = useMemo(() => {
        if (!code || code.trim().length === 0) return false;
        return true;
    }, [code]);

    // -----------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------

    const handleFormatChange = useCallback((f: ExportFormat) => {
        setFormat(f);
    }, []);

    const handleStartRender = useCallback(() => {
        setConfirmVisible(true);
    }, []);

    const handleConfirmDismiss = useCallback(() => {
        setConfirmVisible(false);
    }, []);

    const handleRenderQueued = useCallback(
        (jobId: string) => {
            setConfirmVisible(false);
            onRenderQueued?.(jobId);
        },
        [onRenderQueued],
    );

    // -----------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------

    return (
        <View style={styles.container} testID={testID}>
            {/* ----------------------------------------------------------- */}
            {/* Format Selector                                              */}
            {/* ----------------------------------------------------------- */}
            <SectionHeader icon="file-video-outline" title="Format" />
            <View style={styles.chipRow}>
                {FORMAT_KEYS.map((f) => {
                    const opt = EXPORT_FORMATS[f];
                    const isSelected = format === f;
                    return (
                        <Chip
                            key={f}
                            selected={isSelected}
                            onPress={() => handleFormatChange(f)}
                            mode="outlined"
                            style={[
                                styles.chip,
                                isSelected && { backgroundColor: theme.colors.primaryContainer },
                            ]}
                            textStyle={{
                                color: isSelected
                                    ? theme.colors.primary
                                    : theme.colors.onSurfaceVariant,
                            }}
                            testID={`${testID}-format-${f}`}
                        >
                            {opt.label}
                        </Chip>
                    );
                })}
            </View>
            <Text
                variant="bodySmall"
                style={[styles.codecHint, { color: theme.colors.onSurfaceVariant }]}
                testID={`${testID}-codec`}
            >
                Codec: {EXPORT_FORMATS[format].codec}
            </Text>

            <Divider style={styles.divider} />

            {/* ----------------------------------------------------------- */}
            {/* Quality Presets                                               */}
            {/* ----------------------------------------------------------- */}
            <SectionHeader icon="tune" title="Quality" />
            <View style={styles.chipRow}>
                {QUALITY_KEYS.map((q) => {
                    const preset = QUALITY_PRESETS[q];
                    const isSelected = quality === q;
                    return (
                        <Chip
                            key={q}
                            selected={isSelected}
                            onPress={() => setQuality(q)}
                            mode="outlined"
                            style={[
                                styles.chip,
                                isSelected && { backgroundColor: theme.colors.primaryContainer },
                            ]}
                            textStyle={{
                                color: isSelected
                                    ? theme.colors.primary
                                    : theme.colors.onSurfaceVariant,
                            }}
                            testID={`${testID}-quality-${q}`}
                        >
                            {preset.label}
                        </Chip>
                    );
                })}
            </View>
            <Text
                variant="bodySmall"
                style={[styles.codecHint, { color: theme.colors.onSurfaceVariant }]}
            >
                {QUALITY_PRESETS[quality].description}
            </Text>

            <Divider style={styles.divider} />

            {/* ----------------------------------------------------------- */}
            {/* Resolution                                                   */}
            {/* ----------------------------------------------------------- */}
            <SectionHeader icon="monitor" title="Resolution" />
            <View style={styles.chipRow}>
                {availableResolutions.map((r) => {
                    const opt = EXPORT_RESOLUTIONS[r];
                    const isSelected = resolution === r;
                    return (
                        <Chip
                            key={r}
                            selected={isSelected}
                            onPress={() => setResolution(r)}
                            mode="outlined"
                            style={[
                                styles.chip,
                                isSelected && { backgroundColor: theme.colors.primaryContainer },
                            ]}
                            textStyle={{
                                color: isSelected
                                    ? theme.colors.primary
                                    : theme.colors.onSurfaceVariant,
                            }}
                            testID={`${testID}-resolution-${r}`}
                        >
                            {opt.label}
                        </Chip>
                    );
                })}
            </View>

            <Divider style={styles.divider} />

            {/* ----------------------------------------------------------- */}
            {/* FPS (hidden for GIF)                                         */}
            {/* ----------------------------------------------------------- */}
            {EXPORT_FORMATS[format].fpsSelectorEnabled && (
                <>
                    <SectionHeader icon="speedometer" title="Frame Rate" />
                    <View style={styles.chipRow}>
                        {FPS_OPTIONS.map((f) => {
                            const isSelected = renderFps === f;
                            return (
                                <Chip
                                    key={f}
                                    selected={isSelected}
                                    onPress={() => setRenderFps(f)}
                                    mode="outlined"
                                    style={[
                                        styles.chip,
                                        isSelected && {
                                            backgroundColor: theme.colors.primaryContainer,
                                        },
                                    ]}
                                    textStyle={{
                                        color: isSelected
                                            ? theme.colors.primary
                                            : theme.colors.onSurfaceVariant,
                                    }}
                                    testID={`${testID}-fps-${f}`}
                                >
                                    {f} fps
                                </Chip>
                            );
                        })}
                    </View>
                    <Divider style={styles.divider} />
                </>
            )}

            {/* ----------------------------------------------------------- */}
            {/* Output Filename                                              */}
            {/* ----------------------------------------------------------- */}
            <SectionHeader icon="file-outline" title="Output Filename" />
            <TextInput
                value={outputFilename}
                onChangeText={setOutputFilename}
                mode="outlined"
                dense
                style={styles.filenameInput}
                testID={`${testID}-filename`}
            />

            <Divider style={styles.divider} />

            {/* ----------------------------------------------------------- */}
            {/* Render Method                                                */}
            {/* ----------------------------------------------------------- */}
            <SectionHeader icon="cloud-outline" title="Render Method" />
            <View style={styles.chipRow}>
                <Chip
                    selected={renderMethod === 'cloud'}
                    mode="outlined"
                    style={[
                        styles.chip,
                        renderMethod === 'cloud' && { backgroundColor: theme.colors.primaryContainer },
                    ]}
                    textStyle={{ color: theme.colors.primary }}
                    testID={`${testID}-method-cloud`}
                >
                    ☁️ Cloud Render
                </Chip>
                <Chip
                    selected={false}
                    mode="outlined"
                    disabled
                    style={styles.chip}
                    textStyle={{ color: theme.colors.onSurfaceDisabled }}
                    testID={`${testID}-method-local`}
                >
                    🖥️ Local · Coming Soon
                </Chip>
            </View>

            <Divider style={styles.divider} />

            {/* ----------------------------------------------------------- */}
            {/* Estimate Summary Card                                        */}
            {/* ----------------------------------------------------------- */}
            <Surface
                style={[styles.summaryCard, { backgroundColor: theme.colors.surfaceVariant }]}
                elevation={0}
                testID={`${testID}-summary`}
            >
                <View style={styles.summaryRow}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        Duration
                    </Text>
                    <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onSurface, fontWeight: '600' }}
                        testID={`${testID}-duration`}
                    >
                        {estimate.durationSeconds.toFixed(1)}s ({durationInFrames} frames)
                    </Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        Est. File Size
                    </Text>
                    <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onSurface, fontWeight: '600' }}
                        testID={`${testID}-filesize`}
                    >
                        ~{formatFileSize(estimate.estimatedFileSize)}
                    </Text>
                </View>
            </Surface>

            {/* ----------------------------------------------------------- */}
            {/* Validation Error                                             */}
            {/* ----------------------------------------------------------- */}
            {!hasComposition && (
                <View
                    style={[styles.validationError, { backgroundColor: theme.colors.errorContainer }]}
                    testID={`${testID}-validation-error`}
                >
                    <Icon source="alert-circle-outline" size={18} color={theme.colors.error} />
                    <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.error, flex: 1 }}
                    >
                        Could not detect composition settings. Please ensure your code exports a
                        Composition.
                    </Text>
                </View>
            )}

            {/* ----------------------------------------------------------- */}
            {/* Start Render Button                                          */}
            {/* ----------------------------------------------------------- */}
            <Button
                mode="contained"
                icon="rocket-launch-outline"
                onPress={handleStartRender}
                disabled={!hasComposition}
                style={styles.renderButton}
                contentStyle={styles.renderButtonContent}
                testID={`${testID}-start-render`}
            >
                Start Render
            </Button>

            {/* ----------------------------------------------------------- */}
            {/* Confirmation Sheet                                           */}
            {/* ----------------------------------------------------------- */}
            <RenderConfirmSheet
                visible={confirmVisible}
                onDismiss={handleConfirmDismiss}
                onConfirm={handleRenderQueued}
                projectId={projectId}
                codeUrl={codeUrl}
                format={format}
                quality={quality}
                resolution={resolution}
                fps={format === 'gif' ? compositionFps : renderFps}
                durationInFrames={durationInFrames}
                compositionWidth={compositionWidth}
                compositionHeight={compositionHeight}
                outputFilename={outputFilename}
                estimate={estimate}
                testID={`${testID}-confirm-sheet`}
            />
        </View>
    );
}

// ---------------------------------------------------------------------------
// Section Header — reusable small layout
// ---------------------------------------------------------------------------

function SectionHeader({ icon, title }: { icon: string; title: string }) {
    const theme = useAppTheme();
    return (
        <View style={styles.sectionHeader}>
            <Icon source={icon} size={18} color={theme.colors.onSurface} />
            <Text variant="titleSmall" style={{ color: theme.colors.onSurface, marginLeft: spacing.sm }}>
                {title}
            </Text>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: spacing.lg,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginBottom: spacing.xs,
    },
    chip: {
        height: 32,
    },
    codecHint: {
        marginTop: spacing.xs,
        marginBottom: spacing.xs,
    },
    divider: {
        marginVertical: spacing.md,
    },
    filenameInput: {
        marginBottom: spacing.xs,
    },
    summaryCard: {
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
    creditRow: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingTop: spacing.sm,
        marginTop: spacing.xs,
    },
    validationError: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radii.md,
        marginBottom: spacing.md,
    },
    renderButton: {
        marginTop: spacing.sm,
    },
    renderButtonContent: {
        paddingVertical: spacing.xs,
    },
});
