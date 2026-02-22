/**
 * Home Screen — app landing page.
 *
 * Shows time-based greeting, quick action cards, recent projects
 * horizontal scroll, and stats summary. Displays empty state on first launch.
 */
import React, { useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import type { Project } from '@renderflow/shared';
import { useProjectStore, useAuthStore } from '../../src/stores';
import { useSubscriptionStore } from '../../src/stores/useSubscriptionStore';
import { useAppTheme } from '../../src/theme';
import { spacing, layout } from '../../src/theme/tokens';
import { EmptyState } from '../../src/components/EmptyState';
import { QuickActionCard } from '../../src/components/QuickActionCard';
import { StatsCard } from '../../src/components/StatsCard';
import type { StatItem } from '../../src/components/StatsCard';
import { ProjectCard } from '../../src/components/ProjectCard';
import { ProjectOptionsSheet } from '../../src/components/ProjectOptionsSheet';
import { Plus, ClipboardPaste, FileDown } from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

function formatStorageSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HomeScreen() {
    const theme = useAppTheme();
    const router = useRouter();

    // Stores
    const user = useAuthStore((s) => s.user);
    const isGuest = useAuthStore((s) => s.isGuest);
    const projects = useProjectStore((s) => s.projects);
    const isLoading = useProjectStore((s) => s.isLoading);
    const loadProjects = useProjectStore((s) => s.loadProjects);
    const updateProject = useProjectStore((s) => s.updateProject);
    const deleteProject = useProjectStore((s) => s.deleteProject);
    const duplicateProject = useProjectStore((s) => s.duplicateProject);
    const toggleFavorite = useProjectStore((s) => s.toggleFavorite);

    const usage = useSubscriptionStore((s) => s.usage);
    const loadSubscription = useSubscriptionStore((s) => s.loadSubscription);

    // Greeting name
    const displayName = isGuest ? 'Guest' : (user?.displayName ?? 'User');

    // Options sheet state
    const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);

    useEffect(() => {
        void loadProjects({ sortBy: 'updatedAt', sortOrder: 'desc', limit: 20 });
        void loadSubscription();
    }, [loadProjects, loadSubscription]);

    // Stats
    const stats = useMemo<StatItem[]>(() => [
        { icon: 'folder-outline', label: 'Projects', value: String(projects.length) },
        { icon: 'movie-outline', label: 'Renders', value: String(usage?.rendersToday ?? 0) },
        { icon: 'database-outline', label: 'Storage', value: formatStorageSize(usage?.storageUsedBytes ?? 0) },
    ], [projects.length, usage]);

    // Handlers
    const handleNewProject = useCallback(() => {
        router.push('/project/new' as never);
    }, [router]);

    const handlePasteCode = useCallback(() => {
        router.push('/project/new' as never);
    }, [router]);

    const handleImportFile = useCallback(() => {
        router.push('/project/new' as never);
    }, [router]);

    const handleProjectPress = useCallback((project: Project) => {
        router.push(`/project/${project.id}` as never);
    }, [router]);

    const handleProjectLongPress = useCallback((project: Project) => {
        setSelectedProject(project);
    }, []);

    const _handleToggleFavorite = useCallback((project: Project) => {
        void toggleFavorite(project.id);
    }, [toggleFavorite]);

    const handleOptionsRename = useCallback((id: string, name: string) => {
        void updateProject(id, { name });
    }, [updateProject]);

    const handleOptionsDuplicate = useCallback((id: string) => {
        void duplicateProject(id);
    }, [duplicateProject]);

    const handleOptionsToggleFavorite = useCallback((id: string) => {
        void toggleFavorite(id);
    }, [toggleFavorite]);

    const handleOptionsDelete = useCallback((id: string) => {
        void deleteProject(id);
    }, [deleteProject]);

    const handleDismissOptions = useCallback(() => {
        setSelectedProject(null);
    }, []);

    // Recent projects (up to 10)
    const recentProjects = useMemo(
        () => projects.slice(0, 10),
        [projects],
    );

    // Render helpers
    const renderRecentItem = useCallback(({ item }: { item: Project }) => (
        <View style={styles.recentCardWrapper}>
            <ProjectCard
                project={item}
                compact
                onPress={handleProjectPress}
                onLongPress={handleProjectLongPress}
                testID={`recent-project-${item.id}`}
            />
        </View>
    ), [handleProjectPress, handleProjectLongPress]);

    const hasProjects = projects.length > 0;

    return (
        <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                testID="home-scroll"
            >
                {/* Greeting */}
                <View style={styles.greetingContainer}>
                    <Text
                        variant="headlineMedium"
                        style={[styles.greeting, { color: theme.colors.onSurface }]}
                        testID="home-greeting"
                    >
                        {getGreeting()}, {displayName}
                    </Text>
                    <Text
                        variant="bodyMedium"
                        style={{ color: theme.colors.onSurfaceVariant }}
                    >
                        What will you create today?
                    </Text>
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text
                        variant="titleSmall"
                        style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}
                    >
                        QUICK ACTIONS
                    </Text>
                    <View style={styles.quickActionsRow}>
                        <QuickActionCard
                            icon={Plus}
                            label="New Project"
                            onPress={handleNewProject}
                            testID="quick-action-new"
                        />
                        <QuickActionCard
                            icon={ClipboardPaste}
                            label="Paste Code"
                            onPress={handlePasteCode}
                            testID="quick-action-paste"
                        />
                        <QuickActionCard
                            icon={FileDown}
                            label="Import File"
                            onPress={handleImportFile}
                            testID="quick-action-import"
                        />
                    </View>
                </View>

                {/* Content area */}
                {isLoading && projects.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                    </View>
                ) : !hasProjects ? (
                    <EmptyState
                        icon="movie-open-outline"
                        title="No projects yet"
                        subtitle="Create your first code-to-video project and start rendering beautiful animations."
                        actionLabel="Create Project"
                        onAction={handleNewProject}
                        testID="home-empty-state"
                    />
                ) : (
                    <>
                        {/* Stats */}
                        <View style={styles.section}>
                            <StatsCard items={stats} testID="home-stats" />
                        </View>

                        {/* Recent Projects */}
                        <View style={styles.section}>
                            <Text
                                variant="titleSmall"
                                style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}
                            >
                                RECENT PROJECTS
                            </Text>
                            <View style={styles.recentListContainer}>
                                <FlashList
                                    data={recentProjects}
                                    renderItem={renderRecentItem}
                                    estimatedItemSize={160}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.recentList}
                                    testID="recent-projects-list"
                                />
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>

            {/* Project Options Sheet */}
            <ProjectOptionsSheet
                visible={selectedProject !== null}
                project={selectedProject}
                onDismiss={handleDismissOptions}
                onRename={handleOptionsRename}
                onDuplicate={handleOptionsDuplicate}
                onToggleFavorite={handleOptionsToggleFavorite}
                onDelete={handleOptionsDelete}
                testID="home-project-options"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 60,
        paddingBottom: spacing['4xl'],
    },
    greetingContainer: {
        paddingHorizontal: layout.screenPaddingHorizontal,
        marginBottom: spacing['3xl'],
        marginTop: spacing.md,
    },
    greeting: {
        fontWeight: '700',
        marginBottom: spacing.xs,
    },
    section: {
        paddingHorizontal: layout.screenPaddingHorizontal,
        marginBottom: spacing['3xl'],
    },
    sectionTitle: {
        fontWeight: '700',
        letterSpacing: 1.2,
        marginBottom: spacing.lg,
    },
    quickActionsRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    loadingContainer: {
        paddingVertical: spacing['6xl'],
        alignItems: 'center',
    },
    recentListContainer: {
        height: 170,
        marginHorizontal: -layout.screenPaddingHorizontal,
    },
    recentList: {
        paddingHorizontal: layout.screenPaddingHorizontal,
    },
    recentCardWrapper: {
        marginRight: spacing.md,
    },
});
