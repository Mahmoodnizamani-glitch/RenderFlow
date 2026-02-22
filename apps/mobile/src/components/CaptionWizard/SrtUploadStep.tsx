/**
 * SrtUploadStep — Step 1 of the Caption Wizard.
 *
 * Allows users to upload an SRT file via document picker or paste
 * raw SRT text into a text area. Parses the input and shows validation
 * warnings and a summary (entry count, total duration).
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
    Button,
    SegmentedButtons,
    Text,
    TextInput,
    Banner,
} from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { parseSrt, SrtParseError } from '@renderflow/shared';
import type { SrtFile } from '@renderflow/shared';
import { useAppTheme } from '../../theme';
import { spacing, radii } from '../../theme/tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SrtUploadStepProps {
    /** Called when SRT is successfully parsed */
    onParsed: (srtFile: SrtFile, rawText: string) => void;
    /** Previously parsed SRT file (for back navigation) */
    initialSrtFile?: SrtFile | null;
    /** Previously entered raw text */
    initialRawText?: string;
    testID?: string;
}

type InputMode = 'upload' | 'paste';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SrtUploadStep({
    onParsed,
    initialSrtFile = null,
    initialRawText = '',
    testID = 'srt-upload-step',
}: SrtUploadStepProps) {
    const theme = useAppTheme();
    const [mode, setMode] = useState<InputMode>('paste');
    const [rawText, setRawText] = useState(initialRawText);
    const [parsedFile, setParsedFile] = useState<SrtFile | null>(initialSrtFile);
    const [error, setError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);

    // -----------------------------------------------------------------------
    // Parse SRT text
    // -----------------------------------------------------------------------

    const parseInput = useCallback(
        (text: string) => {
            setError(null);
            setWarnings([]);
            try {
                const result = parseSrt(text);
                setParsedFile(result);
                setWarnings(result.warnings);
                onParsed(result, text);
            } catch (e) {
                if (e instanceof SrtParseError) {
                    setError(e.message);
                } else {
                    setError('Failed to parse SRT file');
                }
                setParsedFile(null);
            }
        },
        [onParsed],
    );

    // -----------------------------------------------------------------------
    // File upload handler
    // -----------------------------------------------------------------------

    const handleFileUpload = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/plain', 'application/x-subrip', 'text/srt', '*/*'],
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                setIsLoading(false);
                return;
            }

            const asset = result.assets[0]!;
            setFileName(asset.name);

            const content = await FileSystem.readAsStringAsync(asset.uri);
            setRawText(content);
            parseInput(content);
        } catch (e) {
            setError(
                e instanceof Error
                    ? `File read error: ${e.message}`
                    : 'Failed to read file',
            );
        } finally {
            setIsLoading(false);
        }
    }, [parseInput]);

    // -----------------------------------------------------------------------
    // Paste handler
    // -----------------------------------------------------------------------

    const handleParseText = useCallback(() => {
        if (rawText.trim().length === 0) {
            setError('Please paste or type SRT content');
            return;
        }
        parseInput(rawText);
    }, [rawText, parseInput]);

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            testID={testID}
        >
            <Text variant="titleLarge" style={styles.title}>
                Import Subtitles
            </Text>
            <Text
                variant="bodyMedium"
                style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
            >
                Upload an SRT file or paste subtitle text to get started
            </Text>

            {/* Mode selector */}
            <SegmentedButtons
                value={mode}
                onValueChange={(v) => setMode(v as InputMode)}
                buttons={[
                    { value: 'paste', label: 'Paste Text', icon: 'text' },
                    { value: 'upload', label: 'Upload File', icon: 'file-upload' },
                ]}
                style={styles.modeSelector}
            />

            {mode === 'upload' ? (
                <View style={styles.uploadSection}>
                    <Button
                        mode="outlined"
                        icon="file-document-outline"
                        onPress={handleFileUpload}
                        loading={isLoading}
                        disabled={isLoading}
                        testID={`${testID}-upload-btn`}
                        style={styles.uploadButton}
                        contentStyle={styles.uploadButtonContent}
                    >
                        {fileName ? `Selected: ${fileName}` : 'Choose SRT File'}
                    </Button>
                </View>
            ) : (
                <View style={styles.pasteSection}>
                    <TextInput
                        mode="outlined"
                        label="SRT Content"
                        value={rawText}
                        onChangeText={setRawText}
                        multiline
                        numberOfLines={10}
                        style={styles.textArea}
                        outlineColor={theme.colors.outline}
                        activeOutlineColor={theme.colors.primary}
                        placeholder={PLACEHOLDER_SRT}
                        testID={`${testID}-textarea`}
                    />
                    <Button
                        mode="contained"
                        onPress={handleParseText}
                        disabled={rawText.trim().length === 0}
                        style={styles.parseButton}
                        testID={`${testID}-parse-btn`}
                    >
                        Parse SRT
                    </Button>
                </View>
            )}

            {/* Error banner */}
            {error && (
                <Banner
                    visible
                    icon="alert-circle"
                    style={[styles.banner, { backgroundColor: theme.colors.errorContainer }]}
                    actions={[]}
                    testID={`${testID}-error`}
                >
                    <Text style={{ color: theme.colors.onErrorContainer }}>{error}</Text>
                </Banner>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
                <View
                    style={[styles.warningBox, { backgroundColor: theme.colors.tertiaryContainer }]}
                    testID={`${testID}-warnings`}
                >
                    <Text variant="labelMedium" style={{ color: theme.colors.onTertiaryContainer }}>
                        ⚠ {warnings.length} warning{warnings.length > 1 ? 's' : ''}
                    </Text>
                    {warnings.slice(0, 3).map((w, i) => (
                        <Text
                            key={i}
                            variant="bodySmall"
                            style={{ color: theme.colors.onTertiaryContainer }}
                        >
                            • {w}
                        </Text>
                    ))}
                    {warnings.length > 3 && (
                        <Text
                            variant="bodySmall"
                            style={{ color: theme.colors.onTertiaryContainer }}
                        >
                            ...and {warnings.length - 3} more
                        </Text>
                    )}
                </View>
            )}

            {/* Parsed summary */}
            {parsedFile && (
                <View
                    style={[styles.summaryBox, { backgroundColor: theme.colors.primaryContainer }]}
                    testID={`${testID}-summary`}
                >
                    <Text
                        variant="titleMedium"
                        style={{ color: theme.colors.onPrimaryContainer }}
                    >
                        ✓ Parsed Successfully
                    </Text>
                    <View style={styles.summaryRow}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                            Entries: {parsedFile.totalEntries}
                        </Text>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                            Duration: {formatDuration(parsedFile.totalDurationMs)}
                        </Text>
                    </View>
                </View>
            )}
        </ScrollView>
    );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLACEHOLDER_SRT = `1
00:00:01,000 --> 00:00:04,000
Hello, world!

2
00:00:05,000 --> 00:00:08,000
This is a subtitle.`;

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
        marginBottom: spacing.lg,
    },
    modeSelector: {
        marginBottom: spacing.lg,
    },
    uploadSection: {
        marginBottom: spacing.lg,
    },
    uploadButton: {
        borderStyle: 'dashed',
    },
    uploadButtonContent: {
        paddingVertical: spacing.xl,
    },
    pasteSection: {
        marginBottom: spacing.lg,
    },
    textArea: {
        minHeight: 200,
        marginBottom: spacing.md,
    },
    parseButton: {
        alignSelf: 'flex-end',
    },
    banner: {
        marginBottom: spacing.md,
        borderRadius: radii.md,
    },
    warningBox: {
        padding: spacing.md,
        borderRadius: radii.md,
        marginBottom: spacing.md,
    },
    summaryBox: {
        padding: spacing.lg,
        borderRadius: radii.md,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.sm,
    },
});
