/**
 * Quick action card for Home screen.
 *
 * Compact pressable card with icon + label, used in the quick actions row.
 */
import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../theme';
import { spacing, radii, shadows } from '../theme/tokens';

export interface QuickActionCardProps {
    icon: React.ElementType;
    label: string;
    onPress: () => void;
    color?: string;
    testID?: string;
}

export function QuickActionCard({
    icon,
    label,
    onPress,
    color,
    testID,
}: QuickActionCardProps) {
    const theme = useAppTheme();
    const iconColor = color ?? theme.colors.primary;

    return (
        <Pressable
            style={({ pressed }) => [
                styles.card,
                { backgroundColor: theme.colors.surfaceVariant },
                pressed && styles.pressed,
            ]}
            onPress={onPress}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <View style={[styles.iconCircle, { backgroundColor: `${iconColor}20` }]}>
                {React.createElement(icon, { size: 24, color: iconColor, strokeWidth: 2 })}
            </View>
            <Text
                variant="labelMedium"
                style={[styles.label, { color: theme.colors.onSurface }]}
                numberOfLines={1}
            >
                {label}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.md,
        borderRadius: radii.xl,
        ...shadows.sm,
    },
    pressed: {
        opacity: 0.7,
        transform: [{ scale: 0.97 }],
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    label: {
        textAlign: 'center',
        fontWeight: '500',
    },
});
