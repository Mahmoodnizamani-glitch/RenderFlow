/**
 * BooleanInput — switch toggle for boolean-type variables.
 */
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { spacing } from '../../theme/tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BooleanInputProps {
    name: string;
    label: string;
    value: boolean;
    onValueChange: (name: string, value: boolean) => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BooleanInput({
    name,
    label,
    value,
    onValueChange,
    testID = 'boolean-input',
}: BooleanInputProps) {
    const theme = useAppTheme();

    const handleToggle = useCallback(() => {
        onValueChange(name, !value);
    }, [name, value, onValueChange]);

    return (
        <View style={styles.container} testID={testID}>
            <Text
                variant="bodyMedium"
                style={[styles.label, { color: theme.colors.onSurface }]}
            >
                {label}
            </Text>
            <Switch
                value={value}
                onValueChange={handleToggle}
                testID={`${testID}-switch`}
            />
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
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
        paddingVertical: spacing.xs,
    },
    label: {
        flex: 1,
        marginRight: spacing.md,
    },
});
