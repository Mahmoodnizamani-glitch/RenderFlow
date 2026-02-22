/**
 * ResolutionSelector — resolution quality toggle for the preview player.
 *
 * Renders a row of chips: 360p / 540p / 720p (default) / 1080p.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import { PREVIEW_RESOLUTIONS } from './previewBridge';
import type { PreviewResolutionKey } from './previewBridge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolutionSelectorProps {
    /** Currently selected resolution */
    selectedResolution: PreviewResolutionKey;
    /** Called when a resolution is selected */
    onResolutionChange: (resolution: PreviewResolutionKey) => void;
    /** Test ID */
    testID?: string;
}

// ---------------------------------------------------------------------------
// Resolution keys in display order
// ---------------------------------------------------------------------------

const RESOLUTION_KEYS: PreviewResolutionKey[] = ['360p', '540p', '720p', '1080p'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResolutionSelector({
    selectedResolution,
    onResolutionChange,
    testID = 'resolution-selector',
}: ResolutionSelectorProps) {
    const theme = useAppTheme();

    return (
        <View
            style={[styles.container, { backgroundColor: theme.colors.surface }]}
            testID={testID}
        >
            <Text
                variant="labelSmall"
                style={[styles.label, { color: theme.colors.onSurfaceVariant }]}
            >
                Quality
            </Text>
            <View style={styles.chips}>
                {RESOLUTION_KEYS.map((key) => {
                    const isSelected = selectedResolution === key;
                    return (
                        <Chip
                            key={key}
                            selected={isSelected}
                            onPress={() => onResolutionChange(key)}
                            compact
                            mode="outlined"
                            style={[
                                styles.chip,
                                isSelected && { backgroundColor: theme.colors.primaryContainer },
                            ]}
                            textStyle={[
                                styles.chipText,
                                { color: isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant },
                            ]}
                            testID={`${testID}-${key}`}
                        >
                            {PREVIEW_RESOLUTIONS[key].label}
                        </Chip>
                    );
                })}
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
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    label: {
        marginRight: spacing.sm,
    },
    chips: {
        flexDirection: 'row',
        gap: spacing.xs,
        flex: 1,
    },
    chip: {
        height: 28,
    },
    chipText: {
        fontSize: 11,
    },
});
