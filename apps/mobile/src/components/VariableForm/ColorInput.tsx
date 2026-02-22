/**
 * ColorInput — hex color input with swatch palette for color-type variables.
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { spacing } from '../../theme/tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColorInputProps {
    name: string;
    label: string;
    value: string;
    onValueChange: (name: string, value: string) => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Color swatches
// ---------------------------------------------------------------------------

const COLOR_SWATCHES = [
    '#FF0000', '#FF5722', '#FF9800', '#FFC107',
    '#FFEB3B', '#8BC34A', '#4CAF50', '#009688',
    '#00BCD4', '#03A9F4', '#2196F3', '#3F51B5',
    '#673AB7', '#9C27B0', '#E91E63', '#795548',
    '#607D8B', '#9E9E9E', '#000000', '#FFFFFF',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEX_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

function isValidHex(color: string): boolean {
    return HEX_REGEX.test(color);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ColorInput({
    name,
    label,
    value,
    onValueChange,
    testID = 'color-input',
}: ColorInputProps) {
    const theme = useAppTheme();

    const handleTextChange = useCallback(
        (text: string) => {
            // Auto-prepend # if user types without it
            const normalized = text.startsWith('#') ? text : `#${text}`;
            onValueChange(name, normalized);
        },
        [name, onValueChange],
    );

    const handleSwatchPress = useCallback(
        (color: string) => {
            onValueChange(name, color);
        },
        [name, onValueChange],
    );

    const displayColor = isValidHex(value) ? value : '#000000';

    return (
        <View style={styles.container} testID={testID}>
            <Text
                variant="labelMedium"
                style={[styles.label, { color: theme.colors.onSurfaceVariant }]}
            >
                {label}
            </Text>

            <View style={styles.inputRow}>
                <View
                    style={[
                        styles.preview,
                        {
                            backgroundColor: displayColor,
                            borderColor: theme.colors.outline,
                        },
                    ]}
                    testID={`${testID}-preview`}
                />
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={handleTextChange}
                    mode="outlined"
                    dense
                    maxLength={9}
                    placeholder="#000000"
                    autoCapitalize="characters"
                    outlineColor={theme.colors.outline}
                    activeOutlineColor={theme.colors.primary}
                    error={value.length > 0 && !isValidHex(value)}
                    testID={`${testID}-field`}
                />
            </View>

            <View style={styles.swatchGrid} testID={`${testID}-swatches`}>
                {COLOR_SWATCHES.map((color) => (
                    <Pressable
                        key={color}
                        style={[
                            styles.swatch,
                            {
                                backgroundColor: color,
                                borderColor:
                                    value === color ? theme.colors.primary : theme.colors.outline,
                                borderWidth: value === color ? 2 : StyleSheet.hairlineWidth,
                            },
                        ]}
                        onPress={() => handleSwatchPress(color)}
                        testID={`${testID}-swatch-${color.replace('#', '')}`}
                        accessibilityLabel={`Select color ${color}`}
                    />
                ))}
            </View>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const SWATCH_SIZE = 32;
const SWATCH_GAP = spacing.xs;

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.sm,
    },
    label: {
        marginBottom: spacing.xs,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    preview: {
        width: 40,
        height: 40,
        borderRadius: 8,
        borderWidth: 1,
    },
    input: {
        flex: 1,
    },
    swatchGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SWATCH_GAP,
    },
    swatch: {
        width: SWATCH_SIZE,
        height: SWATCH_SIZE,
        borderRadius: 6,
    },
});
