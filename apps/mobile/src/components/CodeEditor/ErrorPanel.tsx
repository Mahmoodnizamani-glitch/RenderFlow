/**
 * ErrorPanel — collapsible bottom panel showing editor diagnostic errors.
 *
 * Displays error/warning markers with line numbers. Tapping an error
 * scrolls the editor to that line via the onGoToLine callback.
 */
import React, { useCallback } from 'react';
import {
    FlatList,
    StyleSheet,
    View,
} from 'react-native';
import { Icon, Text, TouchableRipple } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { spacing, radii } from '../../theme/tokens';
import type { EditorMarker } from './editorBridge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorPanelProps {
    markers: EditorMarker[];
    onGoToLine: (line: number) => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ErrorPanel({
    markers,
    onGoToLine,
    testID = 'error-panel',
}: ErrorPanelProps) {
    const theme = useAppTheme();

    const renderItem = useCallback(
        ({ item }: { item: EditorMarker }) => {
            const isError = item.severity === 'error';
            const iconName = isError ? 'close-circle' : 'alert';
            const iconColor = isError ? theme.colors.error : '#FDCB6E';

            return (
                <TouchableRipple
                    onPress={() => onGoToLine(item.startLine)}
                    testID={`${testID}-item-${item.startLine}`}
                >
                    <View style={styles.item}>
                        <Icon source={iconName} size={16} color={iconColor} />
                        <Text
                            variant="labelSmall"
                            style={[styles.lineNumber, { color: theme.colors.onSurfaceVariant }]}
                        >
                            L{item.startLine}
                        </Text>
                        <Text
                            variant="bodySmall"
                            numberOfLines={2}
                            style={[styles.message, { color: theme.colors.onSurface }]}
                        >
                            {item.message}
                        </Text>
                    </View>
                </TouchableRipple>
            );
        },
        [onGoToLine, testID, theme.colors],
    );

    const keyExtractor = useCallback(
        (item: EditorMarker, index: number) =>
            `${item.startLine}-${item.startColumn}-${index}`,
        [],
    );

    if (markers.length === 0) {
        return null;
    }

    const errorCount = markers.filter((m) => m.severity === 'error').length;
    const warningCount = markers.filter((m) => m.severity === 'warning').length;

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: theme.colors.surfaceVariant,
                    borderTopColor: theme.colors.outlineVariant,
                },
            ]}
            testID={testID}
        >
            {/* Header */}
            <View style={styles.header}>
                <Text
                    variant="labelMedium"
                    style={{ color: theme.colors.onSurface }}
                >
                    Problems
                </Text>
                <View style={styles.badges}>
                    {errorCount > 0 && (
                        <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
                            <Text variant="labelSmall" style={styles.badgeText}>
                                {errorCount}
                            </Text>
                        </View>
                    )}
                    {warningCount > 0 && (
                        <View style={[styles.badge, { backgroundColor: '#FDCB6E' }]}>
                            <Text variant="labelSmall" style={[styles.badgeText, { color: '#000' }]}>
                                {warningCount}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Error list */}
            <FlatList
                data={markers}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                style={styles.list}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        maxHeight: 180,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    badges: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    badge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radii.full,
        minWidth: 22,
        alignItems: 'center',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
    list: {
        flex: 1,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.sm,
    },
    lineNumber: {
        minWidth: 32,
        fontVariant: ['tabular-nums'],
    },
    message: {
        flex: 1,
    },
});
