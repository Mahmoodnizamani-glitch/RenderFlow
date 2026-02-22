import React from 'react';
import { StyleSheet } from 'react-native';
import { Appbar } from 'react-native-paper';
import type { StyleProp, ViewStyle } from 'react-native';

export interface AppHeaderAction {
    icon: string;
    onPress: () => void;
    accessibilityLabel: string;
}

export interface AppHeaderProps {
    title: string;
    subtitle?: string;
    onBack?: () => void;
    actions?: AppHeaderAction[];
    elevated?: boolean;
    style?: StyleProp<ViewStyle>;
    testID?: string;
}

export function AppHeader({
    title,
    subtitle,
    onBack,
    actions = [],
    elevated = false,
    style,
    testID,
}: AppHeaderProps) {
    return (
        <Appbar.Header
            elevated={elevated}
            style={[styles.header, style]}
            testID={testID}
            accessibilityRole="header"
        >
            {onBack && (
                <Appbar.BackAction
                    onPress={onBack}
                    accessibilityLabel="Go back"
                    testID={testID ? `${testID}-back` : undefined}
                />
            )}
            <Appbar.Content
                title={title}
                subtitle={subtitle}
                titleStyle={styles.title}
            />
            {actions.map((action, index) => (
                <Appbar.Action
                    key={`${action.icon}-${index}`}
                    icon={action.icon}
                    onPress={action.onPress}
                    accessibilityLabel={action.accessibilityLabel}
                    testID={testID ? `${testID}-action-${index}` : undefined}
                />
            ))}
        </Appbar.Header>
    );
}

const styles = StyleSheet.create({
    header: {
        // Allow theme to control background color
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
    },
});
