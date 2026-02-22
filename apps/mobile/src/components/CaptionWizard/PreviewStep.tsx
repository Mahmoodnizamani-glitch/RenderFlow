/**
 * PreviewStep — Step 4 of the Caption Wizard.
 *
 * Generates Remotion code from the SRT + style + config, shows it in the
 * PreviewPlayer, and provides a "Create Project" button to save the result
 * as a new project.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, Snackbar } from 'react-native-paper';
import type { SrtFile, CaptionStyleId, CaptionStyleConfig } from '@renderflow/shared';
import { generateWordTimings, ASPECT_DIMENSIONS } from '@renderflow/shared';
import { useAppTheme } from '../../theme';
import { spacing, radii } from '../../theme/tokens';
import {
    generateCaptionCode,
    getTemplate,
    calculateTotalFrames,
} from '../../templates/captions';
import { PreviewPlayer } from '../PreviewPlayer';
import type { PreviewPlayerHandle } from '../PreviewPlayer';
import { useProjectStore } from '../../stores';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreviewStepProps {
    srtFile: SrtFile;
    styleId: CaptionStyleId;
    config: CaptionStyleConfig;
    /** Called after project is successfully created */
    onProjectCreated?: (projectId: string) => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PreviewStep({
    srtFile,
    styleId,
    config,
    onProjectCreated,
    testID = 'preview-step',
}: PreviewStepProps) {
    const theme = useAppTheme();
    const previewRef = React.useRef<PreviewPlayerHandle>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [snackMessage, setSnackMessage] = useState<string | null>(null);
    const createProject = useProjectStore((s) => s.createProject);

    // -----------------------------------------------------------------------
    // Generate code
    // -----------------------------------------------------------------------

    const wordTimings = useMemo(
        () => generateWordTimings(srtFile.entries),
        [srtFile],
    );

    const generatedCode = useMemo(
        () =>
            generateCaptionCode({
                srtFile,
                wordTimings,
                styleId,
                config,
            }),
        [srtFile, wordTimings, styleId, config],
    );

    const template = useMemo(() => getTemplate(styleId), [styleId]);
    const dimensions = ASPECT_DIMENSIONS[config.aspect];
    const totalFrames = calculateTotalFrames(srtFile.totalDurationMs, config.fps);

    // -----------------------------------------------------------------------
    // Create project
    // -----------------------------------------------------------------------

    const handleCreateProject = useCallback(async () => {
        setIsCreating(true);
        try {
            const project = await createProject({
                name: `${template.name} Captions`,
                description: `Auto-generated ${template.name} captions (${srtFile.totalEntries} entries)`,
                code: generatedCode,
                compositionWidth: dimensions.width,
                compositionHeight: dimensions.height,
                fps: config.fps,
                durationInFrames: totalFrames,
            });
            setSnackMessage('Project created successfully!');
            onProjectCreated?.(project.id);
        } catch (e) {
            setSnackMessage(
                e instanceof Error ? e.message : 'Failed to create project',
            );
        } finally {
            setIsCreating(false);
        }
    }, [
        createProject,
        template,
        srtFile,
        generatedCode,
        dimensions,
        config.fps,
        totalFrames,
        onProjectCreated,
    ]);

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <View style={styles.container} testID={testID}>
            <ScrollView
                style={styles.scrollable}
                contentContainerStyle={styles.content}
            >
                <Text variant="titleLarge" style={styles.title}>
                    Preview & Export
                </Text>
                <Text
                    variant="bodyMedium"
                    style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
                >
                    {template.name} style • {srtFile.totalEntries} entries •{' '}
                    {(srtFile.totalDurationMs / 1000).toFixed(1)}s
                </Text>

                {/* Preview */}
                <View
                    style={[
                        styles.previewContainer,
                        { borderColor: theme.colors.outlineVariant },
                    ]}
                >
                    <PreviewPlayer
                        ref={previewRef}
                        code={generatedCode}
                        compositionWidth={dimensions.width}
                        compositionHeight={dimensions.height}
                        fps={config.fps}
                        durationInFrames={totalFrames}
                        testID={`${testID}-preview`}
                    />
                </View>

                {/* Details */}
                <View
                    style={[
                        styles.detailsBox,
                        { backgroundColor: theme.colors.surfaceVariant },
                    ]}
                    testID={`${testID}-details`}
                >
                    <DetailRow label="Style" value={template.name} />
                    <DetailRow
                        label="Dimensions"
                        value={`${dimensions.width}×${dimensions.height}`}
                    />
                    <DetailRow label="FPS" value={String(config.fps)} />
                    <DetailRow label="Frames" value={String(totalFrames)} />
                    <DetailRow
                        label="Code Size"
                        value={`${(generatedCode.length / 1024).toFixed(1)} KB`}
                    />
                </View>

                {/* Actions */}
                <Button
                    mode="contained"
                    icon="check"
                    onPress={handleCreateProject}
                    loading={isCreating}
                    disabled={isCreating}
                    style={styles.createButton}
                    contentStyle={styles.createButtonContent}
                    testID={`${testID}-create-btn`}
                >
                    Create Project
                </Button>

                <Text
                    variant="bodySmall"
                    style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}
                >
                    The generated code will be saved as a new project. You can
                    edit it further in the code editor.
                </Text>
            </ScrollView>

            <Snackbar
                visible={snackMessage !== null}
                onDismiss={() => setSnackMessage(null)}
                duration={3000}
                testID={`${testID}-snackbar`}
            >
                {snackMessage ?? ''}
            </Snackbar>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Detail Row
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.detailRow}>
            <Text variant="bodyMedium" style={styles.detailLabel}>
                {label}
            </Text>
            <Text variant="bodyMedium">{value}</Text>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollable: {
        flex: 1,
    },
    content: {
        padding: spacing.lg,
        paddingBottom: spacing['5xl'],
    },
    title: {
        marginBottom: spacing.xs,
    },
    subtitle: {
        marginBottom: spacing.lg,
    },
    previewContainer: {
        borderWidth: 1,
        borderRadius: radii.md,
        overflow: 'hidden',
        aspectRatio: 9 / 16,
        maxHeight: 400,
        marginBottom: spacing.lg,
    },
    detailsBox: {
        padding: spacing.md,
        borderRadius: radii.md,
        marginBottom: spacing.lg,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.xs,
    },
    detailLabel: {
        fontWeight: '600',
    },
    createButton: {
        marginBottom: spacing.sm,
    },
    createButtonContent: {
        paddingVertical: spacing.xs,
    },
    hint: {
        textAlign: 'center',
    },
});
