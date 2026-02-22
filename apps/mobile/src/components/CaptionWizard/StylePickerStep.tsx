/**
 * StylePickerStep — Step 2 of the Caption Wizard.
 *
 * Displays a grid of caption style cards with descriptions.
 * The selected style is highlighted with a primary color border.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { CaptionStyleId } from '@renderflow/shared';
import { useAppTheme } from '../../theme';
import { spacing, radii } from '../../theme/tokens';
import { getAllTemplates } from '../../templates/captions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StylePickerStepProps {
    /** Currently selected style ID */
    selectedStyle: CaptionStyleId;
    /** Called when a style is selected */
    onStyleChange: (styleId: CaptionStyleId) => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Style card icons (emoji-based for simplicity)
// ---------------------------------------------------------------------------

const STYLE_ICONS: Record<CaptionStyleId, string> = {
    hormozi: '🔥',
    minimal: '✨',
    bounce: '⚡',
    karaoke: '🎤',
};

const STYLE_PREVIEW_TEXT: Record<CaptionStyleId, string> = {
    hormozi: 'Each WORD pops with emphasis',
    minimal: 'Clean and professional',
    bounce: 'Words spring into view',
    karaoke: 'Progressive color fill',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StylePickerStep({
    selectedStyle,
    onStyleChange,
    testID = 'style-picker-step',
}: StylePickerStepProps) {
    const theme = useAppTheme();
    const templates = getAllTemplates();

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            testID={testID}
        >
            <Text variant="titleLarge" style={styles.title}>
                Choose Caption Style
            </Text>
            <Text
                variant="bodyMedium"
                style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
            >
                Select an animation style for your captions
            </Text>

            <View style={styles.grid}>
                {templates.map((template) => {
                    const isSelected = template.id === selectedStyle;
                    return (
                        <Pressable
                            key={template.id}
                            onPress={() => onStyleChange(template.id)}
                            style={[
                                styles.card,
                                {
                                    backgroundColor: isSelected
                                        ? theme.colors.primaryContainer
                                        : theme.colors.surface,
                                    borderColor: isSelected
                                        ? theme.colors.primary
                                        : theme.colors.outlineVariant,
                                    borderWidth: isSelected ? 2 : 1,
                                    elevation: 2,
                                },
                            ]}
                            testID={`${testID}-card-${template.id}`}
                            accessibilityLabel={`${template.name} caption style`}
                            accessibilityState={{ selected: isSelected }}
                        >
                            <Text style={styles.cardIcon}>
                                {STYLE_ICONS[template.id]}
                            </Text>
                            <Text
                                variant="titleMedium"
                                style={{
                                    color: isSelected
                                        ? theme.colors.onPrimaryContainer
                                        : theme.colors.onSurface,
                                }}
                            >
                                {template.name}
                            </Text>
                            <Text
                                variant="bodySmall"
                                style={[
                                    styles.cardDescription,
                                    {
                                        color: isSelected
                                            ? theme.colors.onPrimaryContainer
                                            : theme.colors.onSurfaceVariant,
                                    },
                                ]}
                                numberOfLines={2}
                            >
                                {template.description}
                            </Text>
                            <View
                                style={[
                                    styles.previewBadge,
                                    {
                                        backgroundColor: isSelected
                                            ? theme.colors.primary
                                            : theme.colors.surfaceVariant,
                                    },
                                ]}
                            >
                                <Text
                                    variant="labelSmall"
                                    style={{
                                        color: isSelected
                                            ? theme.colors.onPrimary
                                            : theme.colors.onSurfaceVariant,
                                    }}
                                >
                                    {STYLE_PREVIEW_TEXT[template.id]}
                                </Text>
                            </View>
                        </Pressable>
                    );
                })}
            </View>
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
        padding: spacing.lg,
    },
    title: {
        marginBottom: spacing.xs,
    },
    subtitle: {
        marginBottom: spacing.xl,
    },
    grid: {
        gap: spacing.md,
    },
    card: {
        padding: spacing.lg,
        borderRadius: radii.lg,
        gap: spacing.xs,
    },
    cardIcon: {
        fontSize: 32,
        marginBottom: spacing.xs,
    },
    cardDescription: {
        marginTop: spacing.xxs,
    },
    previewBadge: {
        marginTop: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radii.sm,
        alignSelf: 'flex-start',
    },
});
