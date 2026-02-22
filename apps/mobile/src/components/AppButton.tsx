import React from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import type { StyleProp, ViewStyle } from 'react-native';
import { layout } from '../theme';

export type AppButtonVariant = 'primary' | 'secondary' | 'outline' | 'text';

export interface AppButtonProps {
    label: string;
    onPress: () => void;
    variant?: AppButtonVariant;
    loading?: boolean;
    disabled?: boolean;
    icon?: string;
    style?: StyleProp<ViewStyle>;
    testID?: string;
    accessibilityLabel?: string;
}

const variantToMode: Record<AppButtonVariant, 'contained' | 'contained-tonal' | 'outlined' | 'text'> = {
    primary: 'contained',
    secondary: 'contained-tonal',
    outline: 'outlined',
    text: 'text',
};

export function AppButton({
    label,
    onPress,
    variant = 'primary',
    loading = false,
    disabled = false,
    icon,
    style,
    testID,
    accessibilityLabel,
}: AppButtonProps) {
    return (
        <Button
            mode={variantToMode[variant]}
            onPress={onPress}
            loading={loading}
            disabled={disabled || loading}
            icon={icon}
            style={[styles.button, style]}
            contentStyle={styles.content}
            testID={testID}
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityRole="button"
        >
            {label}
        </Button>
    );
}

const styles = StyleSheet.create({
    button: {
        borderRadius: 12,
    },
    content: {
        minHeight: layout.minTouchTarget,
        paddingHorizontal: 8,
    },
});
