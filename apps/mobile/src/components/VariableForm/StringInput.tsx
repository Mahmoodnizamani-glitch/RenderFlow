/**
 * StringInput — text input widget for string-type variables.
 */
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import type { InputOptions } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StringInputProps {
    name: string;
    label: string;
    value: string;
    options?: InputOptions;
    onValueChange: (name: string, value: string) => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StringInput({
    name,
    label,
    value,
    options,
    onValueChange,
    testID = 'string-input',
}: StringInputProps) {
    const theme = useAppTheme();

    const handleChange = useCallback(
        (text: string) => {
            onValueChange(name, text);
        },
        [name, onValueChange],
    );

    const isRequired = options?.required === true;
    const hasError = isRequired && value.length === 0;

    return (
        <View style={styles.container} testID={testID}>
            <TextInput
                label={label}
                value={value}
                onChangeText={handleChange}
                maxLength={options?.maxLength}
                placeholder={options?.placeholder}
                mode="outlined"
                error={hasError}
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
                testID={`${testID}-field`}
            />
            {hasError && (
                <HelperText type="error" testID={`${testID}-error`}>
                    {label} is required
                </HelperText>
            )}
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
});
