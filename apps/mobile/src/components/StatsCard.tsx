/**
 * Stats summary card for Home screen.
 *
 * Displays key metrics in a single row: total projects, total renders, storage.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { useAppTheme } from '../theme';
import { spacing, radii, shadows } from '../theme/tokens';

export interface StatItem {
    icon: string;
    label: string;
    value: string;
}

export interface StatsCardProps {
    items: StatItem[];
    testID?: string;
}

export function StatsCard({ items, testID }: StatsCardProps) {
    const theme = useAppTheme();

    return (
        <View
            style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
            testID={testID}
            accessibilityRole="summary"
        >
            {items.map((item, index) => (
                <View
                    key={item.label}
                    style={[
                        styles.statItem,
                        index < items.length - 1 && [
                            styles.divider,
                            { borderRightColor: theme.colors.outlineVariant },
                        ],
                    ]}
                >
                    <Icon source={item.icon} size={20} color={theme.colors.primary} />
                    <Text
                        variant="titleMedium"
                        style={[styles.value, { color: theme.colors.onSurface }]}
                    >
                        {item.value}
                    </Text>
                    <Text
                        variant="labelSmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                    >
                        {item.label}
                    </Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        borderRadius: radii.xl,
        paddingVertical: spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        ...shadows.md,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        gap: spacing.xs,
    },
    divider: {
        borderRightWidth: 1,
    },
    value: {
        fontWeight: '800',
        fontSize: 20,
    },
});
