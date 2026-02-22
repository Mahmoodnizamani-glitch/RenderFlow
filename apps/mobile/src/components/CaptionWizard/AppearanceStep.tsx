/**
 * AppearanceStep — Step 3 of the Caption Wizard.
 *
 * Provides controls for customizing caption appearance:
 * font, size, colors, outline, position, background, dimensions, fps.
 * Reuses existing input patterns from VariableForm.
 */
import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text, TextInput } from 'react-native-paper';
import type {
    CaptionStyleConfig,
    CaptionPosition,
    CaptionBackground,
    VideoAspect,
} from '@renderflow/shared';
import { useAppTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import { ColorInput } from '../VariableForm/ColorInput';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppearanceStepProps {
    config: CaptionStyleConfig;
    onConfigChange: (config: CaptionStyleConfig) => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// FPS options
// ---------------------------------------------------------------------------

const FPS_OPTIONS = [
    { value: '24', label: '24' },
    { value: '30', label: '30' },
    { value: '60', label: '60' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppearanceStep({
    config,
    onConfigChange,
    testID = 'appearance-step',
}: AppearanceStepProps) {
    const theme = useAppTheme();

    const update = useCallback(
        <K extends keyof CaptionStyleConfig>(key: K, value: CaptionStyleConfig[K]) => {
            onConfigChange({ ...config, [key]: value });
        },
        [config, onConfigChange],
    );

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            testID={testID}
        >
            <Text variant="titleLarge" style={styles.title}>
                Customize Appearance
            </Text>
            <Text
                variant="bodyMedium"
                style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
            >
                Fine-tune how your captions look
            </Text>

            {/* Font Family */}
            <SectionHeader title="Font" />
            <TextInput
                mode="outlined"
                label="Font Family"
                value={config.fontFamily}
                onChangeText={(v) => update('fontFamily', v)}
                style={styles.input}
                testID={`${testID}-font-family`}
            />

            {/* Font Size */}
            <SectionHeader title="Font Size" />
            <View style={styles.sliderRow}>
                <TextInput
                    mode="outlined"
                    label="Size (px)"
                    value={String(config.fontSize)}
                    onChangeText={(v) => {
                        const num = parseInt(v, 10);
                        if (!Number.isNaN(num) && num > 0 && num <= 200) {
                            update('fontSize', num);
                        }
                    }}
                    keyboardType="numeric"
                    style={styles.sizeInput}
                    testID={`${testID}-font-size`}
                />
                <View style={styles.sizePresets}>
                    {[32, 48, 64, 80].map((size) => (
                        <SegmentedButtons
                            key={size}
                            value={config.fontSize === size ? String(size) : ''}
                            onValueChange={() => update('fontSize', size)}
                            buttons={[{ value: String(size), label: String(size) }]}
                            style={styles.presetChip}
                        />
                    ))}
                </View>
            </View>

            {/* Colors */}
            <SectionHeader title="Colors" />
            <ColorInput
                name="textColor"
                label="Text Color"
                value={config.textColor}
                onValueChange={(_, v) => update('textColor', v)}
                testID={`${testID}-text-color`}
            />
            <ColorInput
                name="highlightColor"
                label="Highlight Color"
                value={config.highlightColor}
                onValueChange={(_, v) => update('highlightColor', v)}
                testID={`${testID}-highlight-color`}
            />
            <ColorInput
                name="outlineColor"
                label="Outline Color"
                value={config.outlineColor}
                onValueChange={(_, v) => update('outlineColor', v)}
                testID={`${testID}-outline-color`}
            />

            {/* Outline Weight */}
            <SectionHeader title="Outline Weight" />
            <TextInput
                mode="outlined"
                label="Weight (px)"
                value={String(config.outlineWeight)}
                onChangeText={(v) => {
                    const num = parseInt(v, 10);
                    if (!Number.isNaN(num) && num >= 0 && num <= 20) {
                        update('outlineWeight', num);
                    }
                }}
                keyboardType="numeric"
                style={styles.input}
                testID={`${testID}-outline-weight`}
            />

            {/* Position */}
            <SectionHeader title="Position" />
            <SegmentedButtons
                value={config.position}
                onValueChange={(v) => update('position', v as CaptionPosition)}
                buttons={[
                    { value: 'top', label: 'Top', icon: 'format-vertical-align-top' },
                    { value: 'center', label: 'Center', icon: 'format-vertical-align-center' },
                    { value: 'bottom', label: 'Bottom', icon: 'format-vertical-align-bottom' },
                ]}
                style={styles.segmented}
            />

            {/* Background */}
            <SectionHeader title="Background" />
            <SegmentedButtons
                value={config.background}
                onValueChange={(v) => update('background', v as CaptionBackground)}
                buttons={[
                    { value: 'none', label: 'None' },
                    { value: 'solid', label: 'Solid' },
                    { value: 'gradient', label: 'Gradient' },
                ]}
                style={styles.segmented}
            />

            {/* Aspect Ratio */}
            <SectionHeader title="Video Dimensions" />
            <SegmentedButtons
                value={config.aspect}
                onValueChange={(v) => update('aspect', v as VideoAspect)}
                buttons={[
                    { value: '16:9', label: '16:9' },
                    { value: '9:16', label: '9:16' },
                    { value: '1:1', label: '1:1' },
                ]}
                style={styles.segmented}
            />

            {/* FPS */}
            <SectionHeader title="FPS" />
            <SegmentedButtons
                value={String(config.fps)}
                onValueChange={(v) => update('fps', parseInt(v, 10))}
                buttons={FPS_OPTIONS}
                style={styles.segmented}
            />
        </ScrollView>
    );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
    return (
        <Text variant="labelLarge" style={styles.sectionHeader}>
            {title}
        </Text>
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
        padding: spacing.lg,
        paddingBottom: spacing['5xl'],
    },
    title: {
        marginBottom: spacing.xs,
    },
    subtitle: {
        marginBottom: spacing.lg,
    },
    sectionHeader: {
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
    },
    input: {
        marginBottom: spacing.sm,
    },
    sliderRow: {
        gap: spacing.sm,
    },
    sizeInput: {
        marginBottom: spacing.sm,
    },
    sizePresets: {
        flexDirection: 'row',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    presetChip: {
        flex: 1,
    },
    segmented: {
        marginBottom: spacing.md,
    },
});
