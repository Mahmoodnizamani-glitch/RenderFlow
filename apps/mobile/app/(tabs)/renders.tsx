/**
 * Renders Screen — render history, queue management, and re-download.
 *
 * FlashList with section headers: Active (queued/processing), Completed, Failed.
 * Filter chips, date range, sort options. Pull-to-refresh.
 * Credit balance display + storage management.
 */
import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Chip, Text, Button, Divider, IconButton } from 'react-native-paper';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import type { RenderJob } from '@renderflow/shared';
import { useRenderStore, useAuthStore } from '../../src/stores';
import { useAppTheme } from '../../src/theme';
import { spacing, layout, radii } from '../../src/theme/tokens';
import { EmptyState } from '../../src/components/EmptyState';
import { RenderJobCard } from '../../src/components/RenderJobCard';
import { RenderDetailSheet } from '../../src/components/RenderDetailSheet';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import {
    getTotalCacheSize,
    clearAllCache,
    formatCacheSize,
    cleanExpiredCache,
} from '../../src/services/renderCache';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | 'active' | 'completed' | 'failed';
type DateRange = 'all' | 'today' | 'week' | 'month';
type SortMode = 'newest' | 'oldest';

type SectionHeader = { type: 'header'; title: string; count: number; key: string };
type SectionItem = { type: 'item'; job: RenderJob; key: string };
type ListItem = SectionHeader | SectionItem;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES = new Set(['queued', 'processing', 'encoding']);

function isWithinDateRange(dateStr: string | null, range: DateRange): boolean {
    if (range === 'all' || !dateStr) return true;

    const date = new Date(dateStr);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (range) {
        case 'today':
            return date >= startOfDay;
        case 'week': {
            const weekAgo = new Date(startOfDay);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return date >= weekAgo;
        }
        case 'month': {
            const monthAgo = new Date(startOfDay);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return date >= monthAgo;
        }
        default:
            return true;
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RendersScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    const isGuest = useAuthStore((s) => s.isGuest);
    const logout = useAuthStore((s) => s.logout);

    // Store
    const activeJobs = useRenderStore((s) => s.activeJobs);
    const jobHistory = useRenderStore((s) => s.jobHistory);
    const isLoading = useRenderStore((s) => s.isLoading);
    const creditBalance = useRenderStore((s) => s.creditBalance);
    const refreshAll = useRenderStore((s) => s.refreshAll);
    const cancelCloudRender = useRenderStore((s) => s.cancelCloudRender);
    const deleteJob = useRenderStore((s) => s.deleteJob);
    const retryRender = useRenderStore((s) => s.retryRender);
    const getDownloadUrl = useRenderStore((s) => s.getDownloadUrl);

    // Local state
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [dateRange, setDateRange] = useState<DateRange>('all');
    const [sortMode, setSortMode] = useState<SortMode>('newest');
    const [selectedJob, setSelectedJob] = useState<RenderJob | null>(null);
    const [cancelJob, setCancelJob] = useState<RenderJob | null>(null);
    const [cacheSize, setCacheSize] = useState(0);
    const [clearCacheConfirm, setClearCacheConfirm] = useState(false);
    const [showDateRange, setShowDateRange] = useState(false);

    // Initial load + TTL cleanup
    useEffect(() => {
        if (isGuest) return;
        void refreshAll();
        void cleanExpiredCache();
        void getTotalCacheSize().then(setCacheSize);
    }, [refreshAll, isGuest]);

    // Refresh cache size when jobs change
    useEffect(() => {
        if (isGuest) return;
        void getTotalCacheSize().then(setCacheSize);
    }, [activeJobs.length, jobHistory.length, isGuest]);

    // Guest mode: show sign-in prompt instead of cloud rendering UI
    if (isGuest) {
        return (
            <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
                <View style={styles.headerContainer}>
                    <Text
                        variant="headlineMedium"
                        style={[styles.headerTitle, { color: theme.colors.onSurface }]}
                    >
                        Renders
                    </Text>
                </View>
                <EmptyState
                    icon="cloud-lock-outline"
                    title="Cloud Rendering"
                    subtitle="Sign in to access cloud rendering, track jobs, and manage credits."
                    actionLabel="Sign In"
                    onAction={() => {
                        void logout().then(() => {
                            router.replace('/(auth)/login' as never);
                        });
                    }}
                    testID="renders-guest-empty"
                />
            </View>
        );
    }

    // -----------------------------------------------------------------
    // Merged, filtered, sorted data → section list items
    // -----------------------------------------------------------------

    const listData = useMemo((): ListItem[] => {
        const allJobs = [...activeJobs, ...jobHistory];

        // Filter by status
        let filtered = allJobs;
        switch (statusFilter) {
            case 'active':
                filtered = filtered.filter((j) => ACTIVE_STATUSES.has(j.status));
                break;
            case 'completed':
                filtered = filtered.filter((j) => j.status === 'completed');
                break;
            case 'failed':
                filtered = filtered.filter((j) => j.status === 'failed');
                break;
        }

        // Filter by date range
        filtered = filtered.filter((j) => isWithinDateRange(j.createdAt, dateRange));

        // Sort
        filtered.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return sortMode === 'newest' ? dateB - dateA : dateA - dateB;
        });

        // Group into sections (only for 'all' filter)
        if (statusFilter !== 'all') {
            return filtered.map((job) => ({
                type: 'item' as const,
                job,
                key: job.id,
            }));
        }

        const active = filtered.filter((j) => ACTIVE_STATUSES.has(j.status));
        const completed = filtered.filter((j) => j.status === 'completed');
        const failed = filtered.filter((j) => j.status === 'failed');

        const items: ListItem[] = [];

        if (active.length > 0) {
            items.push({ type: 'header', title: 'Active', count: active.length, key: 'h-active' });
            active.forEach((job) => items.push({ type: 'item', job, key: job.id }));
        }

        if (completed.length > 0) {
            items.push({ type: 'header', title: 'Completed', count: completed.length, key: 'h-completed' });
            completed.forEach((job) => items.push({ type: 'item', job, key: job.id }));
        }

        if (failed.length > 0) {
            items.push({ type: 'header', title: 'Failed', count: failed.length, key: 'h-failed' });
            failed.forEach((job) => items.push({ type: 'item', job, key: job.id }));
        }

        return items;
    }, [activeJobs, jobHistory, statusFilter, dateRange, sortMode]);

    // -----------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------

    const handleRefresh = useCallback(() => {
        void refreshAll();
    }, [refreshAll]);

    const handleFilterChange = useCallback((filter: StatusFilter) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setStatusFilter(filter);
    }, []);

    const handleDateRangeChange = useCallback((range: DateRange) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setDateRange(range);
        setShowDateRange(false);
    }, []);

    const handleToggleSort = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSortMode((prev) => (prev === 'newest' ? 'oldest' : 'newest'));
    }, []);

    const handleCardPress = useCallback((job: RenderJob) => {
        setSelectedJob(job);
    }, []);

    const handleCancel = useCallback((job: RenderJob) => {
        setCancelJob(job);
    }, []);

    const handleConfirmCancel = useCallback(() => {
        if (cancelJob?.remoteJobId) {
            void cancelCloudRender(cancelJob.remoteJobId);
        }
        setCancelJob(null);
    }, [cancelJob, cancelCloudRender]);

    const handleRetry = useCallback((job: RenderJob) => {
        void retryRender(job.id);
        setSelectedJob(null);
    }, [retryRender]);

    const handleDownload = useCallback(async (job: RenderJob) => {
        if (job.remoteJobId) {
            try {
                const { downloadUrl } = await getDownloadUrl(job.remoteJobId);
                const { downloadAndCache } = await import('../../src/services/renderCache');
                await downloadAndCache(job.id, downloadUrl, job.format || 'mp4');
                void getTotalCacheSize().then(setCacheSize);
            } catch {
                // Error handled by store
            }
        }
    }, [getDownloadUrl]);

    const handleShare = useCallback(async (job: RenderJob) => {
        if (job.outputUri) {
            const Sharing = await import('expo-sharing');
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(job.outputUri);
            }
        }
    }, []);

    const handleDelete = useCallback((job: RenderJob) => {
        void deleteJob(job.id);
        setSelectedJob(null);
    }, [deleteJob]);

    const handleRerender = useCallback((job: RenderJob) => {
        void retryRender(job.id);
        setSelectedJob(null);
    }, [retryRender]);

    const handleViewProject = useCallback((projectId: string) => {
        router.push(`/project/${projectId}` as never);
        setSelectedJob(null);
    }, [router]);

    const handleClearCache = useCallback(() => {
        setClearCacheConfirm(true);
    }, []);

    const handleConfirmClearCache = useCallback(async () => {
        await clearAllCache();
        setCacheSize(0);
        setClearCacheConfirm(false);
    }, []);

    // -----------------------------------------------------------------
    // Render helpers
    // -----------------------------------------------------------------

    const renderItem = useCallback(({ item }: { item: ListItem }) => {
        if (item.type === 'header') {
            return (
                <View style={styles.sectionHeader} testID={`section-${item.title.toLowerCase()}`}>
                    <Text
                        variant="titleSmall"
                        style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
                    >
                        {item.title}
                    </Text>
                    <Text
                        variant="labelSmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                    >
                        {item.count}
                    </Text>
                </View>
            );
        }

        return (
            <RenderJobCard
                job={item.job}
                onPress={handleCardPress}
                onCancel={handleCancel}
                onRetry={handleRetry}
                onDownload={handleDownload}
                onShare={handleShare}
                testID={`render-card-${item.job.id}`}
            />
        );
    }, [theme, handleCardPress, handleCancel, handleRetry, handleDownload, handleShare]);

    const keyExtractor = useCallback((item: ListItem) => item.key, []);

    const getItemType = useCallback((item: ListItem) => item.type, []);

    const hasJobs = activeJobs.length > 0 || jobHistory.length > 0;

    // -----------------------------------------------------------------
    // Footer: storage summary
    // -----------------------------------------------------------------

    const renderFooter = useCallback(() => {
        if (!hasJobs) return null;

        return (
            <View style={styles.footerContainer}>
                <Divider style={styles.footerDivider} />

                {/* Storage info */}
                <View style={styles.storageRow}>
                    <View>
                        <Text
                            variant="labelMedium"
                            style={{ color: theme.colors.onSurfaceVariant }}
                        >
                            Cached Videos
                        </Text>
                        <Text
                            variant="bodySmall"
                            style={{ color: theme.colors.onSurfaceVariant }}
                            testID="cache-size"
                        >
                            {formatCacheSize(cacheSize)}
                        </Text>
                    </View>
                    {cacheSize > 0 && (
                        <Button
                            mode="text"
                            compact
                            icon="delete-sweep-outline"
                            textColor={theme.colors.error}
                            onPress={handleClearCache}
                            testID="clear-cache-btn"
                        >
                            Clear
                        </Button>
                    )}
                </View>
            </View>
        );
    }, [theme, hasJobs, cacheSize, handleClearCache]);

    // -----------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------

    return (
        <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={styles.headerContainer}>
                <View style={styles.titleRow}>
                    <Text
                        variant="headlineMedium"
                        style={[styles.headerTitle, { color: theme.colors.onSurface }]}
                    >
                        Renders
                    </Text>

                    {/* Credit badge */}
                    <View
                        style={[
                            styles.creditBadge,
                            { backgroundColor: `${theme.colors.primary}18` },
                        ]}
                    >
                        <Text
                            variant="labelMedium"
                            style={{ color: theme.colors.primary, fontWeight: '600' }}
                            testID="credit-balance"
                        >
                            {creditBalance} credits
                        </Text>
                    </View>
                </View>

                {/* Status filter chips */}
                <View style={styles.filterRow}>
                    <View style={styles.chips}>
                        <Chip
                            selected={statusFilter === 'all'}
                            onPress={() => handleFilterChange('all')}
                            style={styles.chip}
                            testID="filter-all"
                        >
                            All
                        </Chip>
                        <Chip
                            selected={statusFilter === 'active'}
                            onPress={() => handleFilterChange('active')}
                            style={styles.chip}
                            icon="loading"
                            testID="filter-active"
                        >
                            Active
                        </Chip>
                        <Chip
                            selected={statusFilter === 'completed'}
                            onPress={() => handleFilterChange('completed')}
                            style={styles.chip}
                            icon="check-circle-outline"
                            testID="filter-completed"
                        >
                            Done
                        </Chip>
                        <Chip
                            selected={statusFilter === 'failed'}
                            onPress={() => handleFilterChange('failed')}
                            style={styles.chip}
                            icon="alert-circle-outline"
                            testID="filter-failed"
                        >
                            Failed
                        </Chip>
                    </View>
                    <IconButton
                        icon={sortMode === 'newest' ? 'sort-descending' : 'sort-ascending'}
                        size={20}
                        onPress={handleToggleSort}
                        testID="sort-toggle"
                        accessibilityLabel={`Sort by ${sortMode === 'newest' ? 'oldest' : 'newest'} first`}
                    />
                </View>

                {/* Date range selector */}
                {showDateRange ? (
                    <View style={styles.dateRangeRow}>
                        {(['all', 'today', 'week', 'month'] as const).map((range) => (
                            <Chip
                                key={range}
                                selected={dateRange === range}
                                onPress={() => handleDateRangeChange(range)}
                                style={styles.dateChip}
                                compact
                                testID={`date-${range}`}
                            >
                                {range === 'all' ? 'All Time' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'Today'}
                            </Chip>
                        ))}
                    </View>
                ) : (
                    <View style={styles.dateToggleRow}>
                        <Button
                            mode="text"
                            compact
                            icon="calendar-range"
                            onPress={() => setShowDateRange(true)}
                            testID="date-range-toggle"
                        >
                            {dateRange === 'all' ? 'All Time' : dateRange === 'today' ? 'Today' : dateRange === 'week' ? 'This Week' : 'This Month'}
                        </Button>
                    </View>
                )}
            </View>

            {/* Content */}
            {!hasJobs && !isLoading ? (
                <EmptyState
                    icon="movie-open-outline"
                    title="No renders yet"
                    subtitle="Create a project and export your first video!"
                    testID="renders-empty-state"
                />
            ) : (
                <FlashList
                    data={listData}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    getItemType={getItemType}
                    estimatedItemSize={120}
                    refreshing={isLoading}
                    onRefresh={handleRefresh}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListFooterComponent={renderFooter}
                    testID="renders-list"
                />
            )}

            {/* Detail sheet */}
            <RenderDetailSheet
                visible={selectedJob !== null}
                job={selectedJob}
                onDismiss={() => setSelectedJob(null)}
                onCancel={handleCancel}
                onRetry={handleRetry}
                onDownload={handleDownload}
                onShare={handleShare}
                onDelete={handleDelete}
                onRerender={handleRerender}
                onViewProject={handleViewProject}
                testID="render-detail"
            />

            {/* Cancel confirmation */}
            <ConfirmDialog
                visible={cancelJob !== null}
                title="Cancel Render"
                message="Are you sure you want to cancel this render? Credits may be partially refunded."
                confirmLabel="Cancel Render"
                destructive
                onConfirm={handleConfirmCancel}
                onCancel={() => setCancelJob(null)}
                testID="cancel-confirm"
            />

            {/* Clear cache confirmation */}
            <ConfirmDialog
                visible={clearCacheConfirm}
                title="Clear Video Cache"
                message={`Delete all cached render videos? This will free ${formatCacheSize(cacheSize)} of storage. Videos can be re-downloaded.`}
                confirmLabel="Clear Cache"
                destructive
                onConfirm={() => void handleConfirmClearCache()}
                onCancel={() => setClearCacheConfirm(false)}
                testID="clear-cache-confirm"
            />
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    headerContainer: {
        paddingTop: 60,
        paddingHorizontal: layout.screenPaddingHorizontal,
        paddingBottom: spacing.sm,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    headerTitle: {
        fontWeight: '700',
    },
    creditBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radii.full,
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    chips: {
        flexDirection: 'row',
        gap: spacing.xs,
        flex: 1,
        flexWrap: 'wrap',
    },
    chip: {
        borderRadius: radii.full,
    },
    dateRangeRow: {
        flexDirection: 'row',
        gap: spacing.xs,
        flexWrap: 'wrap',
        marginBottom: spacing.sm,
    },
    dateChip: {
        borderRadius: radii.full,
    },
    dateToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    listContent: {
        paddingHorizontal: layout.screenPaddingHorizontal,
        paddingBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        marginTop: spacing.sm,
    },
    sectionTitle: {
        fontWeight: '600',
    },
    footerContainer: {
        paddingTop: spacing.lg,
        paddingBottom: spacing['3xl'],
    },
    footerDivider: {
        marginBottom: spacing.md,
    },
    storageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
});
