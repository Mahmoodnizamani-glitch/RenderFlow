/**
 * SelectInput — segmented buttons or dropdown for select-type variables.
 *
 * Uses SegmentedButtons for ≤5 choices, Menu dropdown for >5.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Menu, SegmentedButtons, Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import type { InputOptions } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SelectInputProps {
    name: string;
    label: string;
    value: string;
    options?: InputOptions;
    onValueChange: (name: string, value: string) => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEGMENTED_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SelectInput({
    name,
    label,
    value,
    options,
    onValueChange,
    testID = 'select-input',
}: SelectInputProps) {
    const theme = useAppTheme();
    const choices = options?.choices ?? [];
    const [menuVisible, setMenuVisible] = useState(false);

    const handleSegmentedChange = useCallback(
        (selected: string) => {
            onValueChange(name, selected);
        },
        [name, onValueChange],
    );

    const handleMenuSelect = useCallback(
        (choice: string) => {
            onValueChange(name, choice);
            setMenuVisible(false);
        },
        [name, onValueChange],
    );

    if (choices.length === 0) {
        return (
            <View style={styles.container} testID={testID}>
                <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                >
                    {label}: No choices defined
                </Text>
            </View>
        );
    }

    // Segmented buttons for small sets
    if (choices.length <= SEGMENTED_THRESHOLD) {
        const buttons = choices.map((choice) => ({
            value: choice,
            label: choice,
        }));

        return (
            <View style={styles.container} testID={testID}>
                <Text
                    variant="labelMedium"
                    style={[styles.label, { color: theme.colors.onSurfaceVariant }]}
                >
                    {label}
                </Text>
                <SegmentedButtons
                    value={value}
                    onValueChange={handleSegmentedChange}
                    buttons={buttons}
                />
            </View>
        );
    }

    // Dropdown menu for larger sets
    return (
        <View style={styles.container} testID={testID}>
            <Text
                variant="labelMedium"
                style={[styles.label, { color: theme.colors.onSurfaceVariant }]}
            >
                {label}
            </Text>
            <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                    <Pressable
                        onPress={() => setMenuVisible(true)}
                        style={[
                            styles.menuAnchor,
                            {
                                borderColor: theme.colors.outline,
                                backgroundColor: theme.colors.surface,
                            },
                        ]}
                        testID={`${testID}-anchor`}
                    >
                        <Text
                            variant="bodyMedium"
                            style={{ color: theme.colors.onSurface }}
                        >
                            {value || 'Select…'}
                        </Text>
                    </Pressable>
                }
                testID={`${testID}-menu`}
            >
                {choices.map((choice) => (
                    <Menu.Item
                        key={choice}
                        onPress={() => handleMenuSelect(choice)}
                        title={choice}
                        testID={`${testID}-item-${choice}`}
                    />
                ))}
            </Menu>
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
    label: {
        marginBottom: spacing.xs,
    },
    menuAnchor: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
    },
});
