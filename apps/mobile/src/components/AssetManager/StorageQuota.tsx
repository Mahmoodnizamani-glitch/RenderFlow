/**
 * Storage quota display.
 *
 * Progress bar showing used/total storage with colour thresholds.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ProgressBar, Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import { formatFileSize } from '../../utils/assetUploader';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StorageQuotaProps {
    usedBytes: number;
    totalBytes: number;
    assetCount: number;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const WARNING_PERCENT = 80;
const CRITICAL_PERCENT = 95;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StorageQuota({
    usedBytes,
    totalBytes,
    assetCount,
    testID,
}: StorageQuotaProps) {
    const theme = useAppTheme();

    const percent = totalBytes > 0
        ? Math.min(Math.round((usedBytes / totalBytes) * 100), 100)
        : 0;

    const progress = totalBytes > 0 ? Math.min(usedBytes / totalBytes, 1) : 0;

    const barColor =
        percent >= CRITICAL_PERCENT
            ? theme.colors.error
            : percent >= WARNING_PERCENT
                ? '#F59E0B' // amber/warning
                : theme.colors.primary;

    return (
        <View
            style={[styles.container, { backgroundColor: theme.colors.surfaceVariant }]}
            testID={testID}
        >
            <View style={styles.header}>
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Storage
                </Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {assetCount} asset{assetCount !== 1 ? 's' : ''}
                </Text>
            </View>

            <ProgressBar
                progress={progress}
                color={barColor}
                style={styles.bar}
                testID={testID ? `${testID}-bar` : undefined}
            />

            <View style={styles.footer}>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {formatFileSize(usedBytes)} / {formatFileSize(totalBytes)}
                </Text>
                <Text
                    variant="labelSmall"
                    style={{ color: percent >= WARNING_PERCENT ? barColor : theme.colors.onSurfaceVariant }}
                    testID={testID ? `${testID}-percent` : undefined}
                >
                    {percent}%
                </Text>
            </View>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    bar: {
        height: 6,
        borderRadius: 3,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.xs,
    },
});
