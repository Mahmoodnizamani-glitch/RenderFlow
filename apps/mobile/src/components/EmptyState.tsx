import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import type { StyleProp, ViewStyle } from 'react-native';
import { AppButton } from './AppButton';
import { useAppTheme } from '../theme';
import { spacing } from '../theme/tokens';

export interface EmptyStateProps {
    icon: string;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
    style?: StyleProp<ViewStyle>;
    testID?: string;
}

export function EmptyState({
    icon,
    title,
    subtitle,
    actionLabel,
    onAction,
    style,
    testID,
}: EmptyStateProps) {
    const theme = useAppTheme();

    return (
        <View
            style={[styles.container, style]}
            testID={testID}
            accessibilityRole="text"
            accessibilityLabel={`${title}${subtitle ? `. ${subtitle}` : ''}`}
        >
            <Icon source={icon} size={64} color={theme.colors.onSurfaceVariant} />
            <Text
                variant="titleLarge"
                style={[styles.title, { color: theme.colors.onSurface }]}
            >
                {title}
            </Text>
            {subtitle && (
                <Text
                    variant="bodyMedium"
                    style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
                >
                    {subtitle}
                </Text>
            )}
            {actionLabel && onAction && (
                <AppButton
                    label={actionLabel}
                    onPress={onAction}
                    variant="primary"
                    style={styles.action}
                    testID={testID ? `${testID}-action` : undefined}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing['3xl'],
        paddingVertical: spacing['5xl'],
    },
    title: {
        marginTop: spacing.lg,
        textAlign: 'center',
        fontWeight: '600',
    },
    subtitle: {
        marginTop: spacing.sm,
        textAlign: 'center',
        lineHeight: 22,
    },
    action: {
        marginTop: spacing['2xl'],
    },
});
