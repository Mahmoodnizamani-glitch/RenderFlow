import React from 'react';
import { StyleSheet } from 'react-native';
import { Card } from 'react-native-paper';
import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type AppCardVariant = 'elevated' | 'outlined';

export interface AppCardProps extends PropsWithChildren {
    variant?: AppCardVariant;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
    testID?: string;
    accessibilityLabel?: string;
}

export function AppCard({
    variant = 'elevated',
    style,
    onPress,
    testID,
    accessibilityLabel,
    children,
}: AppCardProps) {
    return (
        <Card
            mode={variant}
            style={[styles.card, style]}
            onPress={onPress}
            testID={testID}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole={onPress ? 'button' : undefined}
        >
            <Card.Content style={styles.content}>{children}</Card.Content>
        </Card>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
    },
    content: {
        paddingVertical: 16,
    },
});
