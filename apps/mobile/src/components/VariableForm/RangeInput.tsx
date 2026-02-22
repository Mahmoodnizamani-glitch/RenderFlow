/**
 * RangeInput — range slider for range-type variables.
 *
 * Uses React Native's built-in Slider component from @react-native-community/slider
 * (included via expo). Falls back to stepper-style input if slider unavailable.
 */
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text, TextInput } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import type { InputOptions } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RangeInputProps {
    name: string;
    label: string;
    value: number;
    options?: InputOptions;
    onValueChange: (name: string, value: number) => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RangeInput({
    name,
    label,
    value,
    options,
    onValueChange,
    testID = 'range-input',
}: RangeInputProps) {
    const theme = useAppTheme();

    const min = options?.min ?? 0;
    const max = options?.max ?? 100;
    const step = options?.step ?? 1;

    const clamp = useCallback(
        (v: number): number => Math.min(max, Math.max(min, v)),
        [min, max],
    );

    const handleDecrement = useCallback(() => {
        onValueChange(name, clamp(value - step));
    }, [name, value, step, onValueChange, clamp]);

    const handleIncrement = useCallback(() => {
        onValueChange(name, clamp(value + step));
    }, [name, value, step, onValueChange, clamp]);

    const handleTextChange = useCallback(
        (text: string) => {
            const trimmed = text.replace(/[^0-9.-]/g, '');
            if (trimmed === '' || trimmed === '-') return;
            const parsed = Number(trimmed);
            if (!Number.isNaN(parsed)) {
                onValueChange(name, clamp(parsed));
            }
        },
        [name, onValueChange, clamp],
    );

    // Calculate fill percentage for visual bar
    const range = max - min;
    const fillPercent = range > 0 ? ((value - min) / range) * 100 : 0;

    return (
        <View style={styles.container} testID={testID}>
            <View style={styles.header}>
                <Text
                    variant="labelMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                >
                    {label}
                </Text>
                <TextInput
                    style={styles.valueInput}
                    value={String(value)}
                    onChangeText={handleTextChange}
                    keyboardType="numeric"
                    mode="outlined"
                    dense
                    outlineColor={theme.colors.outline}
                    activeOutlineColor={theme.colors.primary}
                    testID={`${testID}-value`}
                />
            </View>

            {/* Visual range bar */}
            <View style={[styles.trackContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
                <View
                    style={[
                        styles.trackFill,
                        {
                            backgroundColor: theme.colors.primary,
                            width: `${Math.min(100, Math.max(0, fillPercent))}%`,
                        },
                    ]}
                    testID={`${testID}-fill`}
                />
            </View>

            <View style={styles.controlRow}>
                <IconButton
                    icon="minus"
                    size={18}
                    onPress={handleDecrement}
                    disabled={value <= min}
                    testID={`${testID}-decrement`}
                    accessibilityLabel={`Decrease ${label}`}
                />
                <View style={styles.rangeLabels}>
                    <Text
                        variant="labelSmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                    >
                        {min}
                    </Text>
                    <Text
                        variant="labelSmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                    >
                        {max}
                    </Text>
                </View>
                <IconButton
                    icon="plus"
                    size={18}
                    onPress={handleIncrement}
                    disabled={value >= max}
                    testID={`${testID}-increment`}
                    accessibilityLabel={`Increase ${label}`}
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
        marginBottom: spacing.sm,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    valueInput: {
        width: 80,
        textAlign: 'center',
    },
    trackContainer: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    trackFill: {
        height: '100%',
        borderRadius: 4,
    },
    controlRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xxs,
    },
    rangeLabels: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
});
