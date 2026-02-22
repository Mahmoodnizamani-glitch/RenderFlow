/**
 * New Project Screen.
 *
 * Three creation options: Paste Code, Import File, Browse Templates (disabled).
 * Name input with auto-generated default. Creates project and navigates back.
 */
import React, { useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useProjectStore } from '../../src/stores';
import { useAppTheme } from '../../src/theme';
import { spacing, layout, radii, palette } from '../../src/theme/tokens';
import { AppButton } from '../../src/components/AppButton';
import { AppHeader } from '../../src/components/AppHeader';
import { QuickActionCard } from '../../src/components/QuickActionCard';
import { ClipboardPaste, FileDown } from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateDefaultName(): string {
    const now = new Date();
    const formatted = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    return `Untitled Project - ${formatted}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewProjectScreen() {
    const theme = useAppTheme();
    const router = useRouter();

    const createProject = useProjectStore((s) => s.createProject);

    const [name, setName] = useState(generateDefaultName());
    const [isCreating, setIsCreating] = useState(false);

    const handleBack = useCallback(() => {
        router.back();
    }, [router]);

    const handlePasteCode = useCallback(async () => {
        if (!name.trim()) return;

        setIsCreating(true);
        try {
            await createProject({ name: name.trim(), code: '' });
            router.back();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to create project';
            Alert.alert('Error', message);
        } finally {
            setIsCreating(false);
        }
    }, [name, createProject, router]);

    const handleImportFile = useCallback(async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/javascript',
                    'application/typescript',
                    'text/javascript',
                    'text/typescript',
                    'text/plain',
                ],
                copyToCacheDirectory: true,
            });

            if (result.canceled || result.assets.length === 0) {
                return;
            }

            const asset = result.assets[0];
            if (!asset) return;

            const fileName = asset.name.replace(/\.(tsx?|jsx?)$/, '') || name.trim();

            setIsCreating(true);
            try {
                // Read file content via fetch (works for cache URIs)
                let code = '';
                try {
                    const response = await fetch(asset.uri);
                    code = await response.text();
                } catch {
                    // If fetch fails, create project without code — user can paste later
                    code = `// Imported from ${asset.name}\n`;
                }

                await createProject({
                    name: fileName,
                    code,
                    description: `Imported from ${asset.name}`,
                });
                router.back();
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Failed to create project';
                Alert.alert('Error', message);
            } finally {
                setIsCreating(false);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to pick file';
            Alert.alert('Error', message);
        }
    }, [name, createProject, router]);

    return (
        <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
            <AppHeader
                title="New Project"
                onBack={handleBack}
                testID="new-project-header"
            />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Name input */}
                <View style={styles.section}>
                    <Text
                        variant="titleSmall"
                        style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
                    >
                        PROJECT NAME
                    </Text>
                    <TextInput
                        mode="outlined"
                        value={name}
                        onChangeText={setName}
                        placeholder="Enter project name"
                        style={styles.nameInput}
                        outlineStyle={styles.nameOutline}
                        testID="new-project-name"
                    />
                </View>

                <Divider style={styles.divider} />

                {/* Creation options */}
                <View style={styles.section}>
                    <Text
                        variant="titleSmall"
                        style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
                    >
                        HOW WOULD YOU LIKE TO START?
                    </Text>

                    <View style={styles.optionsGrid}>
                        {/* Paste Code */}
                        <View style={[styles.optionCard, { backgroundColor: theme.colors.surfaceVariant }]}>
                            <QuickActionCard
                                icon={ClipboardPaste}
                                label="Paste Code"
                                onPress={handlePasteCode}
                                color={palette.primary}
                                testID="option-paste-code"
                            />
                            <Text
                                variant="bodySmall"
                                style={[styles.optionDesc, { color: theme.colors.onSurfaceVariant }]}
                            >
                                Start with an empty editor and paste your Remotion code
                            </Text>
                        </View>

                        {/* Import File */}
                        <View style={[styles.optionCard, { backgroundColor: theme.colors.surfaceVariant }]}>
                            <QuickActionCard
                                icon={FileDown}
                                label="Import File"
                                onPress={handleImportFile}
                                color={palette.accent}
                                testID="option-import-file"
                            />
                            <Text
                                variant="bodySmall"
                                style={[styles.optionDesc, { color: theme.colors.onSurfaceVariant }]}
                            >
                                Import a .tsx or .jsx file from your device
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Create button */}
                <View style={styles.section}>
                    <AppButton
                        label="Create Empty Project"
                        onPress={handlePasteCode}
                        loading={isCreating}
                        disabled={!name.trim()}
                        icon="plus"
                        testID="create-project-btn"
                    />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: spacing['4xl'],
    },
    section: {
        paddingHorizontal: layout.screenPaddingHorizontal,
        paddingVertical: spacing.lg,
    },
    sectionLabel: {
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: spacing.md,
    },
    nameInput: {
        fontSize: 16,
    },
    nameOutline: {
        borderRadius: radii.md,
    },
    divider: {
        marginHorizontal: layout.screenPaddingHorizontal,
    },
    optionsGrid: {
        gap: spacing.md,
    },
    optionCard: {
        borderRadius: radii.md,
        padding: spacing.lg,
        gap: spacing.sm,
    },
    optionDesc: {
        textAlign: 'center',
        lineHeight: 18,
    },
    disabledCard: {
        opacity: 0.6,
    },
});
