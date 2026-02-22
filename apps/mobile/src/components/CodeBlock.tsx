import React, { useCallback } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { Surface, Text, IconButton } from 'react-native-paper';
import type { StyleProp, ViewStyle } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAppTheme } from '../theme';
import { spacing, radii, fontSizes } from '../theme/tokens';

export interface CodeBlockProps {
    code: string;
    language?: string;
    showLineNumbers?: boolean;
    maxHeight?: number;
    onCopy?: () => void;
    style?: StyleProp<ViewStyle>;
    testID?: string;
    accessibilityLabel?: string;
}

export function CodeBlock({
    code,
    language,
    showLineNumbers = true,
    maxHeight = 300,
    onCopy,
    style,
    testID,
    accessibilityLabel,
}: CodeBlockProps) {
    const theme = useAppTheme();

    const handleCopy = useCallback(async () => {
        await Clipboard.setStringAsync(code);
        onCopy?.();
    }, [code, onCopy]);

    const lines = code.split('\n');

    const codeBackground = theme.dark ? '#1E1E1E' : '#F8F8F8';
    const lineNumberColor = theme.dark ? '#555555' : '#BBBBBB';
    const codeColor = theme.dark ? '#D4D4D4' : '#333333';

    return (
        <Surface
            style={[
                styles.container,
                { backgroundColor: codeBackground },
                style,
            ]}
            elevation={1}
            testID={testID}
            accessibilityLabel={accessibilityLabel ?? `Code block${language ? ` in ${language}` : ''}`}
            accessibilityRole="text"
        >
            <View style={styles.header}>
                {language && (
                    <Text
                        variant="labelSmall"
                        style={[styles.language, { color: theme.colors.onSurfaceVariant }]}
                    >
                        {language}
                    </Text>
                )}
                <IconButton
                    icon="content-copy"
                    size={18}
                    onPress={handleCopy}
                    accessibilityLabel="Copy code"
                    testID={testID ? `${testID}-copy` : undefined}
                    style={styles.copyButton}
                />
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ maxHeight }}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                >
                    <View style={styles.codeContainer}>
                        {showLineNumbers && (
                            <View style={styles.lineNumbers}>
                                {lines.map((_, index) => (
                                    <Text
                                        key={index}
                                        style={[styles.lineNumber, { color: lineNumberColor }]}
                                    >
                                        {index + 1}
                                    </Text>
                                ))}
                            </View>
                        )}
                        <View style={styles.codeContent}>
                            {lines.map((line, index) => (
                                <Text key={index} style={[styles.codeLine, { color: codeColor }]}>
                                    {line || ' '}
                                </Text>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </ScrollView>
        </Surface>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: radii.md,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: spacing.md,
        paddingRight: spacing.xs,
        minHeight: 36,
    },
    language: {
        textTransform: 'uppercase',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    copyButton: {
        margin: 0,
    },
    codeContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
    },
    lineNumbers: {
        marginRight: spacing.md,
        alignItems: 'flex-end',
        minWidth: 28,
    },
    lineNumber: {
        fontFamily: 'monospace',
        fontSize: fontSizes.sm,
        lineHeight: 20,
    },
    codeContent: {
        flex: 1,
    },
    codeLine: {
        fontFamily: 'monospace',
        fontSize: fontSizes.sm,
        lineHeight: 20,
    },
});
