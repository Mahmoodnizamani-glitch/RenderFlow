/**
 * Project card component.
 *
 * Reusable card for displaying a project in lists and grids.
 * Shows thumbnail placeholder, name, date, resolution/fps, favorite toggle.
 * Supports long-press for options menu.
 */
import React, { useCallback } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { Film, MonitorPlay, Monitor, Play } from 'lucide-react-native';
import type { Project } from '@renderflow/shared';
import { useAppTheme } from '../theme';
import { spacing, radii, shadows, palette } from '../theme/tokens';

export interface ProjectCardProps {
    project: Project;
    compact?: boolean;
    onPress?: (project: Project) => void;
    onLongPress?: (project: Project) => void;
    onToggleFavorite?: (project: Project) => void;
    testID?: string;
}

/**
 * Formats an ISO date string to a human-readable relative/short format.
 */
function formatDate(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ProjectCard({
    project,
    compact = false,
    onPress,
    onLongPress,
    onToggleFavorite,
    testID,
}: ProjectCardProps) {
    const theme = useAppTheme();

    const handlePress = useCallback(() => {
        onPress?.(project);
    }, [onPress, project]);

    const handleLongPress = useCallback(() => {
        onLongPress?.(project);
    }, [onLongPress, project]);

    const handleFavorite = useCallback(() => {
        onToggleFavorite?.(project);
    }, [onToggleFavorite, project]);

    const resolution = `${project.compositionWidth}×${project.compositionHeight}`;

    if (compact) {
        return (
            <Pressable
                style={({ pressed }) => [
                    styles.compactCard,
                    { backgroundColor: theme.colors.surfaceVariant },
                    pressed && styles.pressed,
                ]}
                onPress={handlePress}
                onLongPress={handleLongPress}
                testID={testID}
                accessibilityRole="button"
                accessibilityLabel={`Project: ${project.name}`}
            >
                <View style={[styles.thumbnail, { backgroundColor: theme.colors.surface }]}>
                    <Film size={24} color={theme.colors.primary} />
                </View>
                <Text
                    variant="labelLarge"
                    style={[styles.compactName, { color: theme.colors.onSurface }]}
                    numberOfLines={1}
                >
                    {project.name}
                </Text>
                <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                    numberOfLines={1}
                >
                    {formatDate(project.updatedAt)}
                </Text>
            </Pressable>
        );
    }

    return (
        <Pressable
            style={({ pressed }) => [
                styles.card,
                { backgroundColor: theme.colors.surfaceVariant },
                pressed && styles.pressed,
            ]}
            onPress={handlePress}
            onLongPress={handleLongPress}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={`Project: ${project.name}`}
        >
            {/* Thumbnail placeholder */}
            <View style={[styles.thumbnailLarge, { backgroundColor: theme.colors.surface }]}>
                <MonitorPlay size={32} color={theme.colors.primary} />
            </View>

            {/* Content */}
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text
                        variant="titleSmall"
                        style={[styles.name, { color: theme.colors.onSurface }]}
                        numberOfLines={1}
                    >
                        {project.name}
                    </Text>
                    {onToggleFavorite && (
                        <IconButton
                            icon={project.isFavorite ? 'star' : 'star-outline'}
                            iconColor={project.isFavorite ? palette.warning : theme.colors.onSurfaceVariant}
                            size={18}
                            onPress={handleFavorite}
                            testID={testID ? `${testID}-favorite` : undefined}
                            accessibilityLabel={project.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            style={styles.favoriteBtn}
                        />
                    )}
                </View>

                {project.description ? (
                    <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                        numberOfLines={1}
                    >
                        {project.description}
                    </Text>
                ) : null}

                <View style={styles.meta}>
                    <View style={styles.badge}>
                        <Monitor size={12} color={theme.colors.onSurfaceVariant} />
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {resolution}
                        </Text>
                    </View>
                    <View style={styles.badge}>
                        <Play size={12} color={theme.colors.onSurfaceVariant} />
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {project.fps}fps
                        </Text>
                    </View>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {formatDate(project.updatedAt)}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: radii.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        ...shadows.md,
    },
    pressed: {
        opacity: 0.85,
        transform: [{ scale: 0.98 }],
    },
    thumbnailLarge: {
        height: 140,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        padding: spacing.lg,
        gap: spacing.sm,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    name: {
        flex: 1,
        fontWeight: '600',
    },
    favoriteBtn: {
        margin: 0,
        marginRight: -spacing.sm,
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.xxs,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    // Compact card styles (horizontal scroll)
    compactCard: {
        width: 200,
        borderRadius: radii.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        ...shadows.sm,
    },
    thumbnail: {
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    compactName: {
        fontWeight: '600',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
    },
});
