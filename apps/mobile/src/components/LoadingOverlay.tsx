import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Portal, Text } from 'react-native-paper';
import type { StyleProp, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme';
import { spacing } from '../theme/tokens';

export interface LoadingOverlayProps {
    visible: boolean;
    message?: string;
    style?: StyleProp<ViewStyle>;
    testID?: string;
}

export function LoadingOverlay({
    visible,
    message,
    style,
    testID,
}: LoadingOverlayProps) {
    const theme = useAppTheme();

    if (!visible) {
        return null;
    }

    return (
        <Portal>
            <View
                style={[styles.overlay, { backgroundColor: theme.colors.backdrop }, style]}
                testID={testID}
                accessibilityRole="alert"
                accessibilityLabel={message ?? 'Loading'}
            >
                <View style={[styles.content, { backgroundColor: theme.colors.surface }]}>
                    <ActivityIndicator
                        animating={true}
                        size="large"
                        color={theme.colors.primary}
                    />
                    {message && (
                        <Text
                            variant="bodyLarge"
                            style={[styles.message, { color: theme.colors.onSurface }]}
                        >
                            {message}
                        </Text>
                    )}
                </View>
            </View>
        </Portal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: spacing['3xl'],
        paddingVertical: spacing['2xl'],
        borderRadius: 16,
        minWidth: 160,
    },
    message: {
        marginTop: spacing.lg,
        textAlign: 'center',
    },
});
