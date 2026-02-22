/**
 * VariableForm — maps VariableDefinition[] to the appropriate input widgets.
 *
 * Renders each variable definition as the matching input component type
 * inside a ScrollView.
 */
import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Divider } from 'react-native-paper';
import { spacing } from '../../theme/tokens';
import type { VariableDefinition, VariableValues } from '@renderflow/shared';
import { StringInput } from './StringInput';
import { NumberInput } from './NumberInput';
import { ColorInput } from './ColorInput';
import { BooleanInput } from './BooleanInput';
import { SelectInput } from './SelectInput';
import { ImageInput } from './ImageInput';
import { RangeInput } from './RangeInput';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VariableFormProps {
    definitions: VariableDefinition[];
    values: VariableValues;
    onValueChange: (name: string, value: unknown) => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VariableForm({
    definitions,
    values,
    onValueChange,
    testID = 'variable-form',
}: VariableFormProps) {
    const renderInput = useCallback(
        (def: VariableDefinition, _index: number) => {
            const itemTestID = `${testID}-item-${def.name}`;
            const currentValue = values[def.name] ?? def.defaultValue;

            const commonProps = {
                name: def.name,
                label: def.label,
                options: def.options,
                onValueChange,
            };

            switch (def.type) {
                case 'string':
                    return (
                        <StringInput
                            key={def.name}
                            {...commonProps}
                            value={typeof currentValue === 'string' ? currentValue : ''}
                            testID={itemTestID}
                        />
                    );

                case 'number':
                    return (
                        <NumberInput
                            key={def.name}
                            {...commonProps}
                            value={typeof currentValue === 'number' ? currentValue : 0}
                            testID={itemTestID}
                        />
                    );

                case 'color':
                    return (
                        <ColorInput
                            key={def.name}
                            name={def.name}
                            label={def.label}
                            value={typeof currentValue === 'string' ? currentValue : '#000000'}
                            onValueChange={onValueChange}
                            testID={itemTestID}
                        />
                    );

                case 'boolean':
                    return (
                        <BooleanInput
                            key={def.name}
                            name={def.name}
                            label={def.label}
                            value={typeof currentValue === 'boolean' ? currentValue : false}
                            onValueChange={onValueChange}
                            testID={itemTestID}
                        />
                    );

                case 'select':
                    return (
                        <SelectInput
                            key={def.name}
                            {...commonProps}
                            value={typeof currentValue === 'string' ? currentValue : ''}
                            testID={itemTestID}
                        />
                    );

                case 'image':
                    return (
                        <ImageInput
                            key={def.name}
                            name={def.name}
                            label={def.label}
                            value={typeof currentValue === 'string' ? currentValue : ''}
                            onValueChange={onValueChange}
                            testID={itemTestID}
                        />
                    );

                case 'range':
                    return (
                        <RangeInput
                            key={def.name}
                            {...commonProps}
                            value={typeof currentValue === 'number' ? currentValue : 0}
                            testID={itemTestID}
                        />
                    );

                default:
                    return null;
            }
        },
        [values, onValueChange, testID],
    );

    if (definitions.length === 0) {
        return null;
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            testID={testID}
        >
            {definitions.map((def, index) => (
                <View key={def.name}>
                    {renderInput(def, index)}
                    {index < definitions.length - 1 && (
                        <Divider style={styles.divider} />
                    )}
                </View>
            ))}
        </ScrollView>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: spacing.md,
    },
    divider: {
        marginVertical: spacing.xs,
    },
});
