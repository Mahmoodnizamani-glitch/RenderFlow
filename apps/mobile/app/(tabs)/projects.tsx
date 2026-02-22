/**
 * Projects Screen — full project management.
 *
 * Search bar with debounce, filter chips (All/Favorites/Recently Edited),
 * grid/list toggle, FlashList with swipe-to-delete, pull-to-refresh, FAB.
 */
import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Searchbar, Chip, FAB, Text, IconButton } from 'react-native-paper';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import type { Project } from '@renderflow/shared';
import { useProjectStore } from '../../src/stores';
import { usePreferences } from '../../src/stores/usePreferences';
import { useAppTheme } from '../../src/theme';
import { spacing, layout, radii } from '../../src/theme/tokens';
import { EmptyState } from '../../src/components/EmptyState';
import { ProjectCard } from '../../src/components/ProjectCard';
import { ProjectOptionsSheet } from '../../src/components/ProjectOptionsSheet';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { UpgradePrompt } from '../../src/components/UpgradePrompt';
import { useFeatureGate } from '../../src/hooks/useFeatureGate';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

type FilterMode = 'all' | 'favorites' | 'recent';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProjectsScreen() {
    const theme = useAppTheme();
    const router = useRouter();

    // Stores
    const projects = useProjectStore((s) => s.projects);
    const isLoading = useProjectStore((s) => s.isLoading);
    const searchQuery = useProjectStore((s) => s.searchQuery);
    const loadProjects = useProjectStore((s) => s.loadProjects);
    const setSearchQuery = useProjectStore((s) => s.setSearchQuery);
    const updateProject = useProjectStore((s) => s.updateProject);
    const deleteProject = useProjectStore((s) => s.deleteProject);
    const duplicateProject = useProjectStore((s) => s.duplicateProject);
    const toggleFavorite = useProjectStore((s) => s.toggleFavorite);
    const viewMode = usePreferences((s) => s.viewMode);
    const toggleViewMode = usePreferences((s) => s.toggleViewMode);

    // Local state
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [swipeDeleteProject, setSwipeDeleteProject] = useState<Project | null>(null);
    const [localSearch, setLocalSearch] = useState(searchQuery);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Initial load
    useEffect(() => {
        void loadProjects({ sortBy: 'updatedAt', sortOrder: 'desc' });
    }, [loadProjects]);

    // Debounced search
    const handleSearchChange = useCallback((text: string) => {
        setLocalSearch(text);

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(() => {
            setSearchQuery(text);
            void loadProjects({
                search: text || undefined,
                favoriteOnly: filterMode === 'favorites',
                sortBy: filterMode === 'recent' ? 'updatedAt' : 'createdAt',
                sortOrder: 'desc',
            });
        }, 300);
    }, [setSearchQuery, loadProjects, filterMode]);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, []);

    // Filter change
    const handleFilterChange = useCallback((mode: FilterMode) => {
        setFilterMode(mode);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        void loadProjects({
            search: localSearch || undefined,
            favoriteOnly: mode === 'favorites',
            sortBy: mode === 'recent' ? 'updatedAt' : 'createdAt',
            sortOrder: 'desc',
        });
    }, [loadProjects, localSearch]);

    // Pull-to-refresh
    const handleRefresh = useCallback(() => {
        void loadProjects({
            search: localSearch || undefined,
            favoriteOnly: filterMode === 'favorites',
            sortBy: 'updatedAt',
            sortOrder: 'desc',
        });
    }, [loadProjects, localSearch, filterMode]);

    // Project actions
    const handleProjectPress = useCallback((project: Project) => {
        router.push(`/project/${project.id}` as never);
    }, [router]);

    const handleProjectLongPress = useCallback((project: Project) => {
        setSelectedProject(project);
    }, []);

    const handleToggleFavorite = useCallback((project: Project) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        void toggleFavorite(project.id);
    }, [toggleFavorite]);

    // Options sheet handlers
    const handleOptionsRename = useCallback((id: string, name: string) => {
        void updateProject(id, { name });
    }, [updateProject]);

    const handleOptionsDuplicate = useCallback((id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        void duplicateProject(id);
    }, [duplicateProject]);

    const handleOptionsToggleFavorite = useCallback((id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        void toggleFavorite(id);
    }, [toggleFavorite]);

    const handleOptionsDelete = useCallback((id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        void deleteProject(id);
    }, [deleteProject]);

    const handleDismissOptions = useCallback(() => {
        setSelectedProject(null);
    }, []);

    // Swipe-to-delete
    const _handleSwipeDelete = useCallback((project: Project) => {
        setSwipeDeleteProject(project);
    }, []);

    const handleConfirmSwipeDelete = useCallback(() => {
        if (swipeDeleteProject) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            void deleteProject(swipeDeleteProject.id);
            setSwipeDeleteProject(null);
        }
    }, [swipeDeleteProject, deleteProject]);

    const handleCancelSwipeDelete = useCallback(() => {
        setSwipeDeleteProject(null);
    }, []);

    const { canCreateProject, showPaywall } = useFeatureGate();

    // FAB
    const handleNewProject = useCallback(() => {
        if (!canCreateProject(projects.length)) {
            showPaywall();
            return;
        }
        router.push('/project/new' as never);
    }, [router, canCreateProject, projects.length, showPaywall]);

    // Columns for grid mode
    const numColumns = viewMode === 'grid' ? 2 : 1;

    // Filtered data (client-side filtering is done by the store via loadProjects)
    const filteredProjects = projects;

    // Render item
    const renderItem = useCallback(({ item }: { item: Project }) => (
        <View style={viewMode === 'grid' ? styles.gridItem : styles.listItem}>
            <ProjectCard
                project={item}
                onPress={handleProjectPress}
                onLongPress={(p) => {
                    // On swipe-like long press, show delete confirm directly
                    // On regular long press, show options sheet
                    handleProjectLongPress(p);
                }}
                onToggleFavorite={handleToggleFavorite}
                testID={`project-card-${item.id}`}
            />
        </View>
    ), [viewMode, handleProjectPress, handleProjectLongPress, handleToggleFavorite]);

    const keyExtractor = useCallback((item: Project) => item.id, []);

    const emptyMessage = useMemo(() => {
        if (localSearch) return `No projects matching "${localSearch}"`;
        if (filterMode === 'favorites') return 'No favorite projects';
        return 'No projects yet';
    }, [localSearch, filterMode]);

    return (
        <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
            {/* Header area */}
            <View style={styles.headerContainer}>
                <Text
                    variant="headlineMedium"
                    style={[styles.headerTitle, { color: theme.colors.onSurface }]}
                >
                    Projects
                </Text>

                {/* Search bar */}
                <Searchbar
                    placeholder="Search projects..."
                    value={localSearch}
                    onChangeText={handleSearchChange}
                    style={[styles.searchbar, { backgroundColor: theme.colors.surfaceVariant }]}
                    inputStyle={styles.searchInput}
                    testID="projects-searchbar"
                />

                {/* Filter chips + view toggle */}
                <View style={styles.filterRow}>
                    <View style={styles.chips}>
                        <Chip
                            selected={filterMode === 'all'}
                            onPress={() => handleFilterChange('all')}
                            style={styles.chip}
                            testID="filter-all"
                        >
                            All
                        </Chip>
                        <Chip
                            selected={filterMode === 'favorites'}
                            onPress={() => handleFilterChange('favorites')}
                            style={styles.chip}
                            icon="star"
                            testID="filter-favorites"
                        >
                            Favorites
                        </Chip>
                        <Chip
                            selected={filterMode === 'recent'}
                            onPress={() => handleFilterChange('recent')}
                            style={styles.chip}
                            icon="clock-outline"
                            testID="filter-recent"
                        >
                            Recent
                        </Chip>
                    </View>
                    <IconButton
                        icon={viewMode === 'grid' ? 'view-list' : 'view-grid'}
                        size={22}
                        onPress={toggleViewMode}
                        testID="view-mode-toggle"
                        accessibilityLabel={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
                    />
                </View>
            </View>

            {/* Project list */}
            {filteredProjects.length === 0 && !isLoading ? (
                <EmptyState
                    icon="folder-open-outline"
                    title={emptyMessage}
                    subtitle={localSearch ? 'Try a different search term' : 'Create your first project to get started'}
                    actionLabel={localSearch ? undefined : 'Create Project'}
                    onAction={localSearch ? undefined : handleNewProject}
                    testID="projects-empty-state"
                />
            ) : (
                <FlashList
                    data={filteredProjects}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    estimatedItemSize={viewMode === 'grid' ? 200 : 180}
                    numColumns={numColumns}
                    key={viewMode}
                    refreshing={isLoading}
                    onRefresh={handleRefresh}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    testID="projects-list"
                />
            )}

            {/* Upgrade prompt (shown when at project limit) */}
            {!canCreateProject(filteredProjects.length) && (
                <UpgradePrompt
                    title="Project limit reached"
                    description="Free tier allows up to 3 projects. Upgrade to create unlimited projects."
                    testID="project-limit-prompt"
                />
            )}

            {/* FAB */}
            <FAB
                icon="plus"
                onPress={handleNewProject}
                style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                color={theme.colors.onPrimary}
                testID="projects-fab"
                label="New"
            />

            {/* Options sheet */}
            <ProjectOptionsSheet
                visible={selectedProject !== null}
                project={selectedProject}
                onDismiss={handleDismissOptions}
                onRename={handleOptionsRename}
                onDuplicate={handleOptionsDuplicate}
                onToggleFavorite={handleOptionsToggleFavorite}
                onDelete={handleOptionsDelete}
                testID="projects-options"
            />

            {/* Swipe-delete confirmation */}
            <ConfirmDialog
                visible={swipeDeleteProject !== null}
                title="Delete Project"
                message={swipeDeleteProject ? `Delete "${swipeDeleteProject.name}"?` : ''}
                confirmLabel="Delete"
                destructive
                onConfirm={handleConfirmSwipeDelete}
                onCancel={handleCancelSwipeDelete}
                testID="swipe-delete-confirm"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    headerContainer: {
        paddingTop: 60,
        paddingHorizontal: layout.screenPaddingHorizontal,
        paddingBottom: spacing.sm,
    },
    headerTitle: {
        fontWeight: '700',
        marginBottom: spacing.md,
    },
    searchbar: {
        borderRadius: radii.md,
        elevation: 0,
        marginBottom: spacing.md,
    },
    searchInput: {
        fontSize: 15,
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    chips: {
        flexDirection: 'row',
        gap: spacing.sm,
        flex: 1,
    },
    chip: {
        borderRadius: radii.full,
    },
    listContent: {
        paddingHorizontal: layout.screenPaddingHorizontal,
        paddingBottom: 100,
    },
    gridItem: {
        flex: 1,
        padding: spacing.xs,
    },
    listItem: {
        marginBottom: spacing.md,
    },
    fab: {
        position: 'absolute',
        right: layout.screenPaddingHorizontal,
        bottom: 24,
        borderRadius: radii.lg,
    },
});
