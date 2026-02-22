/**
 * EditorToolbar — horizontal toolbar for the code editor.
 *
 * Provides undo/redo, format, copy/paste/clear, font size,
 * line numbers toggle, and word wrap toggle.
 */
import React, { useCallback, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { Divider, IconButton, Text } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { useAppTheme } from '../../theme';
import { spacing } from '../../theme/tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditorToolbarProps {
    onUndo: () => void;
    onRedo: () => void;
    onFormat: () => void;
    onCopyAll: () => string | void;
    onPaste: (text: string) => void;
    onClear: () => void;
    onFontSizeChange: (size: number) => void;
    onLineNumbersToggle: (enabled: boolean) => void;
    onWordWrapToggle: (enabled: boolean) => void;
    /** Current code for copy-all */
    currentCode?: string;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 24;
const DEFAULT_FONT_SIZE = 14;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditorToolbar({
    onUndo,
    onRedo,
    onFormat,
    onPaste,
    onClear,
    onFontSizeChange,
    onLineNumbersToggle,
    onWordWrapToggle,
    currentCode = '',
    testID = 'editor-toolbar',
}: EditorToolbarProps) {
    const theme = useAppTheme();
    const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
    const [lineNumbers, setLineNumbers] = useState(true);
    const [wordWrap, setWordWrap] = useState(true);

    const handleDecreaseFontSize = useCallback(() => {
        setFontSize((prev) => {
            const next = Math.max(MIN_FONT_SIZE, prev - 1);
            onFontSizeChange(next);
            return next;
        });
    }, [onFontSizeChange]);

    const handleIncreaseFontSize = useCallback(() => {
        setFontSize((prev) => {
            const next = Math.min(MAX_FONT_SIZE, prev + 1);
            onFontSizeChange(next);
            return next;
        });
    }, [onFontSizeChange]);

    const handleToggleLineNumbers = useCallback(() => {
        setLineNumbers((prev) => {
            const next = !prev;
            onLineNumbersToggle(next);
            return next;
        });
    }, [onLineNumbersToggle]);

    const handleToggleWordWrap = useCallback(() => {
        setWordWrap((prev) => {
            const next = !prev;
            onWordWrapToggle(next);
            return next;
        });
    }, [onWordWrapToggle]);

    const handleCopyAll = useCallback(async () => {
        if (currentCode) {
            await Clipboard.setStringAsync(currentCode);
        }
    }, [currentCode]);

    const handlePaste = useCallback(async () => {
        const text = await Clipboard.getStringAsync();
        if (text) {
            onPaste(text);
        }
    }, [onPaste]);

    const iconColor = theme.colors.onSurfaceVariant;
    const activeColor = theme.colors.primary;

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: theme.colors.surfaceVariant,
                    borderBottomColor: theme.colors.outlineVariant,
                },
            ]}
            testID={testID}
        >
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Undo / Redo */}
                <IconButton
                    icon="undo"
                    size={20}
                    iconColor={iconColor}
                    onPress={onUndo}
                    testID={`${testID}-undo`}
                    accessibilityLabel="Undo"
                />
                <IconButton
                    icon="redo"
                    size={20}
                    iconColor={iconColor}
                    onPress={onRedo}
                    testID={`${testID}-redo`}
                    accessibilityLabel="Redo"
                />

                <Divider style={styles.divider} />

                {/* Format */}
                <IconButton
                    icon="format-align-left"
                    size={20}
                    iconColor={iconColor}
                    onPress={onFormat}
                    testID={`${testID}-format`}
                    accessibilityLabel="Format code"
                />

                <Divider style={styles.divider} />

                {/* Copy / Paste / Clear */}
                <IconButton
                    icon="content-copy"
                    size={20}
                    iconColor={iconColor}
                    onPress={handleCopyAll}
                    testID={`${testID}-copy`}
                    accessibilityLabel="Copy all code"
                />
                <IconButton
                    icon="content-paste"
                    size={20}
                    iconColor={iconColor}
                    onPress={handlePaste}
                    testID={`${testID}-paste`}
                    accessibilityLabel="Paste"
                />
                <IconButton
                    icon="delete-outline"
                    size={20}
                    iconColor={iconColor}
                    onPress={onClear}
                    testID={`${testID}-clear`}
                    accessibilityLabel="Clear code"
                />

                <Divider style={styles.divider} />

                {/* Font size */}
                <IconButton
                    icon="format-font-size-decrease"
                    size={20}
                    iconColor={iconColor}
                    onPress={handleDecreaseFontSize}
                    disabled={fontSize <= MIN_FONT_SIZE}
                    testID={`${testID}-font-decrease`}
                    accessibilityLabel="Decrease font size"
                />
                <View style={styles.fontSizeLabel}>
                    <Text variant="labelSmall" style={{ color: iconColor }}>
                        {fontSize}
                    </Text>
                </View>
                <IconButton
                    icon="format-font-size-increase"
                    size={20}
                    iconColor={iconColor}
                    onPress={handleIncreaseFontSize}
                    disabled={fontSize >= MAX_FONT_SIZE}
                    testID={`${testID}-font-increase`}
                    accessibilityLabel="Increase font size"
                />

                <Divider style={styles.divider} />

                {/* Toggles */}
                <IconButton
                    icon="format-list-numbered"
                    size={20}
                    iconColor={lineNumbers ? activeColor : iconColor}
                    onPress={handleToggleLineNumbers}
                    testID={`${testID}-line-numbers`}
                    accessibilityLabel="Toggle line numbers"
                />
                <IconButton
                    icon="wrap"
                    size={20}
                    iconColor={wordWrap ? activeColor : iconColor}
                    onPress={handleToggleWordWrap}
                    testID={`${testID}-word-wrap`}
                    accessibilityLabel="Toggle word wrap"
                />
            </ScrollView>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        height: 44,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    scrollContent: {
        alignItems: 'center',
        paddingHorizontal: spacing.xs,
    },
    divider: {
        width: 1,
        height: 20,
        marginHorizontal: spacing.xxs,
    },
    fontSizeLabel: {
        minWidth: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
