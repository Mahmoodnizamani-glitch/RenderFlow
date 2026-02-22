import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';
import type { StyleProp, ViewStyle } from 'react-native';

export interface AppInputProps {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    error?: string;
    helperText?: string;
    placeholder?: string;
    secureTextEntry?: boolean;
    multiline?: boolean;
    numberOfLines?: number;
    disabled?: boolean;
    left?: React.ReactNode;
    right?: React.ReactNode;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'url';
    style?: StyleProp<ViewStyle>;
    testID?: string;
    accessibilityLabel?: string;
}

export function AppInput({
    label,
    value,
    onChangeText,
    error,
    helperText,
    placeholder,
    secureTextEntry = false,
    multiline = false,
    numberOfLines,
    disabled = false,
    left,
    right,
    autoCapitalize = 'none',
    keyboardType = 'default',
    style,
    testID,
    accessibilityLabel,
}: AppInputProps) {
    const hasError = Boolean(error);

    return (
        <View style={[styles.container, style]}>
            <TextInput
                mode="outlined"
                label={label}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                secureTextEntry={secureTextEntry}
                multiline={multiline}
                numberOfLines={numberOfLines}
                disabled={disabled}
                error={hasError}
                left={left}
                right={right}
                autoCapitalize={autoCapitalize}
                keyboardType={keyboardType}
                style={styles.input}
                outlineStyle={styles.outline}
                testID={testID}
                accessibilityLabel={accessibilityLabel ?? label}
            />
            {(hasError || helperText) && (
                <HelperText
                    type={hasError ? 'error' : 'info'}
                    visible={true}
                    testID={testID ? `${testID}-helper` : undefined}
                >
                    {error ?? helperText}
                </HelperText>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    input: {
        fontSize: 16,
    },
    outline: {
        borderRadius: 12,
    },
});
