/**
 * UpgradePrompt — reusable banner shown at feature gate points.
 *
 * Displays a concise message about the limit and an "Upgrade" button
 * that navigates to the paywall screen.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, Surface, Icon } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useAppTheme } from '../theme';
import { spacing, radii } from '../theme/tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UpgradePromptProps {
    /** Title text, e.g. "Project limit reached". */
    title: string;
    /** Description text explaining why the gate is triggered. */
    description: string;
    /** Icon name (Material Community Icons). Default: "crown-outline". */
    icon?: string;
    /** Custom CTA text. Default: "Upgrade". */
    ctaLabel?: string;
    /** Test ID for testing. */
    testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UpgradePrompt({
    title,
    description,
    icon = 'crown-outline',
    ctaLabel = 'Upgrade',
    testID = 'upgrade-prompt',
}: UpgradePromptProps) {
    const theme = useAppTheme();
    const router = useRouter();

    return (
        <Surface
            testID={testID}
            style={[
                styles.container,
                {
                    backgroundColor: theme.colors.primaryContainer,
                    borderColor: theme.colors.primary,
                },
            ]}
            elevation={0}
        >
            <View style={styles.row}>
                <Icon
                    source={icon}
                    size={24}
                    color={theme.colors.primary}
                />
                <View style={styles.textContainer}>
                    <Text
                        variant="titleSmall"
                        style={{ color: theme.colors.onPrimaryContainer }}
                    >
                        {title}
                    </Text>
                    <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onPrimaryContainer, opacity: 0.8 }}
                    >
                        {description}
                    </Text>
                </View>
            </View>
            <Button
                mode="contained"
                compact
                onPress={() => router.push('/paywall' as never)}
                style={styles.button}
                testID={`${testID}-button`}
            >
                {ctaLabel}
            </Button>
        </Surface>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        padding: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1,
        marginHorizontal: spacing.md,
        marginVertical: spacing.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },
    textContainer: {
        flex: 1,
        gap: spacing.xs,
    },
    button: {
        alignSelf: 'flex-end',
        marginTop: spacing.sm,
    },
});
