/**
 * NumberInput — numeric input with stepper buttons for number-type variables.
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

export interface NumberInputProps {
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

export function NumberInput({
    name,
    label,
    value,
    options,
    onValueChange,
    testID = 'number-input',
}: NumberInputProps) {
    const theme = useAppTheme();

    const step = options?.step ?? 1;
    const min = options?.min ?? -Infinity;
    const max = options?.max ?? Infinity;

    const clamp = useCallback(
        (v: number): number => Math.min(max, Math.max(min, v)),
        [min, max],
    );

    const handleTextChange = useCallback(
        (text: string) => {
            const trimmed = text.replace(/[^0-9.-]/g, '');
            if (trimmed === '' || trimmed === '-') {
                onValueChange(name, 0);
                return;
            }
            const parsed = Number(trimmed);
            if (!Number.isNaN(parsed)) {
                onValueChange(name, clamp(parsed));
            }
        },
        [name, onValueChange, clamp],
    );

    const handleDecrement = useCallback(() => {
        onValueChange(name, clamp(value - step));
    }, [name, value, step, onValueChange, clamp]);

    const handleIncrement = useCallback(() => {
        onValueChange(name, clamp(value + step));
    }, [name, value, step, onValueChange, clamp]);

    return (
        <View style={styles.container} testID={testID}>
            <Text
                variant="labelMedium"
                style={[styles.label, { color: theme.colors.onSurfaceVariant }]}
            >
                {label}
            </Text>
            <View style={styles.row}>
                <IconButton
                    icon="minus"
                    size={20}
                    onPress={handleDecrement}
                    disabled={value <= min}
                    testID={`${testID}-decrement`}
                    accessibilityLabel={`Decrease ${label}`}
                />
                <TextInput
                    style={styles.input}
                    value={String(value)}
                    onChangeText={handleTextChange}
                    keyboardType="numeric"
                    mode="outlined"
                    dense
                    outlineColor={theme.colors.outline}
                    activeOutlineColor={theme.colors.primary}
                    testID={`${testID}-field`}
                />
                <IconButton
                    icon="plus"
                    size={20}
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
    label: {
        marginBottom: spacing.xs,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        textAlign: 'center',
    },
});
