/**
 * VariablesTab — the content displayed in the project editor's "Variables" tab.
 *
 * Shows an empty state when no getInput() calls are detected, or displays
 * the dynamic form with reset and preset management when variables are found.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Divider, IconButton, Text, TextInput } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import { EmptyState } from '../EmptyState';
import { VariableForm } from './VariableForm';
import { useVariableStore } from '../../stores/useVariableStore';
import type { VariablePreset } from '../../stores/useVariableStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VariablesTabProps {
    testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VariablesTab({
    testID = 'variables-tab',
}: VariablesTabProps) {
    const theme = useAppTheme();
    const {
        definitions,
        values,
        presets,
        activePresetId,
        setValue,
        resetToDefaults,
        savePreset,
        loadPreset,
        deletePreset,
    } = useVariableStore();

    const [presetName, setPresetName] = useState('');
    const [showPresetInput, setShowPresetInput] = useState(false);

    // -----------------------------------------------------------------
    // Callbacks
    // -----------------------------------------------------------------

    const handleValueChange = useCallback(
        (name: string, value: unknown) => {
            setValue(name, value);
        },
        [setValue],
    );

    const handleSavePreset = useCallback(() => {
        const trimmed = presetName.trim();
        if (!trimmed) return;
        savePreset(trimmed);
        setPresetName('');
        setShowPresetInput(false);
    }, [presetName, savePreset]);

    const handleLoadPreset = useCallback(
        (preset: VariablePreset) => {
            loadPreset(preset.id);
        },
        [loadPreset],
    );

    const handleDeletePreset = useCallback(
        (presetId: string) => {
            deletePreset(presetId);
        },
        [deletePreset],
    );

    // -----------------------------------------------------------------
    // Empty state
    // -----------------------------------------------------------------

    if (definitions.length === 0) {
        return (
            <EmptyState
                icon="tune-variant"
                title="No Variables"
                subtitle={
                    "This code doesn't have customizable variables.\n" +
                    'Use getInput() in your Remotion code to add them.'
                }
                testID={`${testID}-empty`}
            />
        );
    }

    // -----------------------------------------------------------------
    // Form + controls
    // -----------------------------------------------------------------

    return (
        <View style={styles.container} testID={testID}>
            {/* Variable form */}
            <VariableForm
                definitions={definitions}
                values={values}
                onValueChange={handleValueChange}
                testID={`${testID}-form`}
            />

            <Divider style={styles.divider} />

            {/* Actions */}
            <View style={styles.actions}>
                <Button
                    mode="outlined"
                    icon="restore"
                    onPress={resetToDefaults}
                    compact
                    testID={`${testID}-reset`}
                >
                    Reset to Defaults
                </Button>

                <Button
                    mode="outlined"
                    icon="content-save-outline"
                    onPress={() => setShowPresetInput(true)}
                    compact
                    testID={`${testID}-save-preset-btn`}
                >
                    Save Preset
                </Button>
            </View>

            {/* Preset name input */}
            {showPresetInput && (
                <View style={styles.presetInputRow} testID={`${testID}-preset-input`}>
                    <TextInput
                        style={styles.presetNameInput}
                        value={presetName}
                        onChangeText={setPresetName}
                        placeholder="Preset name…"
                        mode="outlined"
                        dense
                        maxLength={50}
                        outlineColor={theme.colors.outline}
                        activeOutlineColor={theme.colors.primary}
                        testID={`${testID}-preset-name-field`}
                    />
                    <Button
                        mode="contained"
                        onPress={handleSavePreset}
                        disabled={!presetName.trim()}
                        compact
                        testID={`${testID}-preset-confirm`}
                    >
                        Save
                    </Button>
                    <IconButton
                        icon="close"
                        size={20}
                        onPress={() => {
                            setShowPresetInput(false);
                            setPresetName('');
                        }}
                        testID={`${testID}-preset-cancel`}
                    />
                </View>
            )}

            {/* Preset list */}
            {presets.length > 0 && (
                <View style={styles.presetList} testID={`${testID}-presets`}>
                    <Text
                        variant="labelMedium"
                        style={[styles.presetHeader, { color: theme.colors.onSurfaceVariant }]}
                    >
                        Saved Presets
                    </Text>
                    {presets.map((preset) => (
                        <View
                            key={preset.id}
                            style={[
                                styles.presetItem,
                                {
                                    backgroundColor:
                                        activePresetId === preset.id
                                            ? theme.colors.primaryContainer
                                            : theme.colors.surface,
                                    borderColor: theme.colors.outlineVariant,
                                },
                            ]}
                            testID={`${testID}-preset-${preset.id}`}
                        >
                            <Text
                                variant="bodyMedium"
                                style={{
                                    flex: 1,
                                    color:
                                        activePresetId === preset.id
                                            ? theme.colors.onPrimaryContainer
                                            : theme.colors.onSurface,
                                }}
                                onPress={() => handleLoadPreset(preset)}
                            >
                                {preset.name}
                            </Text>
                            <IconButton
                                icon="delete-outline"
                                size={18}
                                onPress={() => handleDeletePreset(preset.id)}
                                testID={`${testID}-preset-delete-${preset.id}`}
                                accessibilityLabel={`Delete preset ${preset.name}`}
                            />
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    divider: {
        marginVertical: spacing.sm,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
    },
    presetInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
    },
    presetNameInput: {
        flex: 1,
    },
    presetList: {
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    presetHeader: {
        marginBottom: spacing.xs,
    },
    presetItem: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        paddingLeft: spacing.md,
        marginBottom: spacing.xs,
    },
});
