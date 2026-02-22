/**
 * Upload progress display.
 *
 * Shows active uploads with progress bars, filenames, and status.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, ProgressBar, Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import type { UploadTask } from '../../stores/useAssetStore';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UploadProgressProps {
    uploads: Record<string, UploadTask>;
    onClear?: () => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UploadProgress({ uploads, onClear, testID }: UploadProgressProps) {
    const theme = useAppTheme();
    const tasks = Object.values(uploads);

    const activeTasks = tasks.filter((t) => t.status === 'uploading' || t.status === 'pending');
    const completedTasks = tasks.filter((t) => t.status === 'done');
    const errorTasks = tasks.filter((t) => t.status === 'error');

    if (tasks.length === 0) {
        return null;
    }

    return (
        <View
            style={[styles.container, { backgroundColor: theme.colors.surfaceVariant }]}
            testID={testID}
        >
            {/* Header */}
            <View style={styles.header}>
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    {activeTasks.length > 0
                        ? `Uploading ${activeTasks.length} file${activeTasks.length > 1 ? 's' : ''}...`
                        : `${completedTasks.length} uploaded${errorTasks.length > 0 ? `, ${errorTasks.length} failed` : ''}`}
                </Text>
                {activeTasks.length === 0 && onClear && (
                    <IconButton
                        icon="close"
                        size={16}
                        onPress={onClear}
                        testID={testID ? `${testID}-clear` : undefined}
                    />
                )}
            </View>

            {/* Active upload bars */}
            {activeTasks.map((task) => (
                <View key={task.id} style={styles.taskRow} testID={testID ? `${testID}-task-${task.id}` : undefined}>
                    <Text
                        variant="bodySmall"
                        numberOfLines={1}
                        style={[styles.filename, { color: theme.colors.onSurface }]}
                    >
                        {task.filename}
                    </Text>
                    <View style={styles.progressRow}>
                        <ProgressBar
                            progress={task.progress / 100}
                            color={theme.colors.primary}
                            style={styles.progressBar}
                        />
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {task.progress}%
                        </Text>
                    </View>
                </View>
            ))}

            {/* Error tasks */}
            {errorTasks.map((task) => (
                <View key={task.id} style={styles.taskRow}>
                    <Text
                        variant="bodySmall"
                        numberOfLines={1}
                        style={{ color: theme.colors.error }}
                    >
                        ✗ {task.filename}: {task.error ?? 'Upload failed'}
                    </Text>
                </View>
            ))}
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        borderRadius: 8,
        padding: spacing.sm,
        marginHorizontal: spacing.sm,
        marginBottom: spacing.sm,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    taskRow: {
        marginTop: spacing.xs,
    },
    filename: {
        marginBottom: 2,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    progressBar: {
        flex: 1,
        height: 4,
        borderRadius: 2,
    },
});
