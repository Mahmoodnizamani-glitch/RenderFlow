/**
 * Asset toolbar.
 *
 * Filter chips (All | Images | Videos | Audio | Fonts),
 * sort dropdown (Name, Date, Size, Type), and upload FAB.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, IconButton, Menu, Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import type { AssetFilter, AssetSortBy } from '../../stores/useAssetStore';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AssetToolbarProps {
    filter: AssetFilter;
    sortBy: AssetSortBy;
    onFilterChange: (filter: AssetFilter) => void;
    onSortChange: (sortBy: AssetSortBy) => void;
    onUploadPress: () => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTERS: Array<{ value: AssetFilter; label: string; icon: string }> = [
    { value: 'all', label: 'All', icon: 'view-grid' },
    { value: 'image', label: 'Images', icon: 'image' },
    { value: 'video', label: 'Videos', icon: 'video' },
    { value: 'audio', label: 'Audio', icon: 'music-note' },
    { value: 'font', label: 'Fonts', icon: 'format-font' },
];

const SORT_OPTIONS: Array<{ value: AssetSortBy; label: string }> = [
    { value: 'date', label: 'Date' },
    { value: 'name', label: 'Name' },
    { value: 'size', label: 'Size' },
    { value: 'type', label: 'Type' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssetToolbar({
    filter,
    sortBy,
    onFilterChange,
    onSortChange,
    onUploadPress,
    testID,
}: AssetToolbarProps) {
    const theme = useAppTheme();
    const [sortMenuVisible, setSortMenuVisible] = useState(false);

    const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Date';

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]} testID={testID}>
            {/* Filter chips */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
                testID={testID ? `${testID}-filters` : undefined}
            >
                {FILTERS.map((f) => (
                    <Chip
                        key={f.value}
                        selected={filter === f.value}
                        onPress={() => onFilterChange(f.value)}
                        icon={f.icon}
                        mode={filter === f.value ? 'flat' : 'outlined'}
                        compact
                        style={styles.chip}
                        testID={testID ? `${testID}-filter-${f.value}` : undefined}
                    >
                        {f.label}
                    </Chip>
                ))}
            </ScrollView>

            {/* Sort + Upload */}
            <View style={styles.actions}>
                <Menu
                    visible={sortMenuVisible}
                    onDismiss={() => setSortMenuVisible(false)}
                    anchor={
                        <IconButton
                            icon="sort"
                            size={20}
                            onPress={() => setSortMenuVisible(true)}
                            testID={testID ? `${testID}-sort-button` : undefined}
                        />
                    }
                >
                    {SORT_OPTIONS.map((opt) => (
                        <Menu.Item
                            key={opt.value}
                            onPress={() => {
                                onSortChange(opt.value);
                                setSortMenuVisible(false);
                            }}
                            title={opt.label}
                            leadingIcon={sortBy === opt.value ? 'check' : undefined}
                            testID={testID ? `${testID}-sort-${opt.value}` : undefined}
                        />
                    ))}
                </Menu>

                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {currentSortLabel}
                </Text>

                <IconButton
                    icon="plus"
                    mode="contained"
                    size={20}
                    onPress={onUploadPress}
                    containerColor={theme.colors.primary}
                    iconColor={theme.colors.onPrimary}
                    testID={testID ? `${testID}-upload` : undefined}
                />
            </View>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: spacing.sm,
        paddingVertical: spacing.xs,
    },
    chipRow: {
        flexDirection: 'row',
        gap: spacing.xs,
        paddingRight: spacing.sm,
        flexShrink: 1,
    },
    chip: {
        // Compact chips
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 'auto',
    },
});
