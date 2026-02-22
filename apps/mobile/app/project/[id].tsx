/**
 * Project Editor screen.
 *
 * Tabs: Code | Preview | Variables | Assets | Export
 * Code tab includes Monaco editor, toolbar, and error panel.
 * Preview tab includes Remotion Player with playback controls.
 * Export tab includes render settings configuration.
 * Variables tab displays parsed getInput() variables.
 * Assets tab manages project assets (upload, preview, organize).
 */
import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import {
    Appbar,
    Badge,
    Icon,
    SegmentedButtons,
    Snackbar,
    Text,
    TextInput,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemeContext } from '../../src/theme';
import { useAppTheme } from '../../src/theme';
import { spacing } from '../../src/theme/tokens';
import { useProjectStore } from '../../src/stores';
import { CodeEditor } from '../../src/components/CodeEditor/CodeEditor';
import { EditorToolbar } from '../../src/components/CodeEditor/EditorToolbar';
import { ErrorPanel } from '../../src/components/CodeEditor/ErrorPanel';
import { PreviewPlayer } from '../../src/components/PreviewPlayer/PreviewPlayer';
import { PlaybackControls } from '../../src/components/PreviewPlayer/PlaybackControls';
import { ResolutionSelector } from '../../src/components/PreviewPlayer/ResolutionSelector';
import { DEFAULT_PREVIEW_RESOLUTION } from '../../src/components/PreviewPlayer/previewBridge';
import type { PreviewPlayerHandle } from '../../src/components/PreviewPlayer/PreviewPlayer';
import type { PreviewResolutionKey, PlaybackSpeed } from '../../src/components/PreviewPlayer/previewBridge';
import type { CodeEditorHandle } from '../../src/components/CodeEditor/CodeEditor';
import type { EditorMarker } from '../../src/components/CodeEditor/editorBridge';
import { ExportSettings } from '../../src/components/ExportSettings/ExportSettingsView';
import { AppError } from '../../src/errors/AppError';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTO_SAVE_DEBOUNCE_MS = 2000;

const TAB_BUTTONS = [
    { value: 'code', label: 'Code', icon: 'code-tags' },
    { value: 'preview', label: 'Preview', icon: 'play-circle-outline' },
    { value: 'export', label: 'Export', icon: 'export-variant' },
] as const;

type TabValue = typeof TAB_BUTTONS[number]['value'];

// ---------------------------------------------------------------------------
// Composition auto-detection regex patterns
// ---------------------------------------------------------------------------

const COMPOSITION_PATTERNS = {
    width: /(?:width\s*[:=]\s*)(\d+)/,
    height: /(?:height\s*[:=]\s*)(\d+)/,
    fps: /(?:fps\s*[:=]\s*)(\d+)/,
    durationInFrames: /(?:durationInFrames\s*[:=]\s*)(\d+)/,
} as const;

function detectCompositionSettings(code: string): {
    compositionWidth?: number;
    compositionHeight?: number;
    fps?: number;
    durationInFrames?: number;
} {
    const result: Record<string, number> = {};

    const widthMatch = code.match(COMPOSITION_PATTERNS.width);
    if (widthMatch?.[1]) {
        const val = parseInt(widthMatch[1], 10);
        if (val > 0 && val <= 7680) result['compositionWidth'] = val;
    }

    const heightMatch = code.match(COMPOSITION_PATTERNS.height);
    if (heightMatch?.[1]) {
        const val = parseInt(heightMatch[1], 10);
        if (val > 0 && val <= 4320) result['compositionHeight'] = val;
    }

    const fpsMatch = code.match(COMPOSITION_PATTERNS.fps);
    if (fpsMatch?.[1]) {
        const val = parseInt(fpsMatch[1], 10);
        if (val > 0 && val <= 120) result['fps'] = val;
    }

    const durationMatch = code.match(COMPOSITION_PATTERNS.durationInFrames);
    if (durationMatch?.[1]) {
        const val = parseInt(durationMatch[1], 10);
        if (val > 0) result['durationInFrames'] = val;
    }

    return result;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ProjectEditorScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const theme = useAppTheme();
    const { isDark: _isDark } = useContext(ThemeContext);

    // Store
    const project = useProjectStore((s) => s.getProjectById(id ?? ''));
    const updateProject = useProjectStore((s) => s.updateProject);
    const loadProjects = useProjectStore((s) => s.loadProjects);

    // Local state
    const [activeTab, setActiveTab] = useState<TabValue>('code');
    const [projectName, setProjectName] = useState(project?.name ?? '');
    const [isEditingName, setIsEditingName] = useState(false);
    const [isSaved, setIsSaved] = useState(true);
    const [currentCode, setCurrentCode] = useState(project?.code ?? '');
    const [markers, setMarkers] = useState<EditorMarker[]>([]);
    const [_editorReady, setEditorReady] = useState(false);

    // Preview state
    const [previewFrame, setPreviewFrame] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [previewResolution, setPreviewResolution] = useState<PreviewResolutionKey>(DEFAULT_PREVIEW_RESOLUTION);
    const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
    const [isLooping, setIsLooping] = useState(true);
    const [_previewReady, setPreviewReady] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    // Refs
    const editorRef = useRef<CodeEditorHandle>(null);
    const previewRef = useRef<PreviewPlayerHandle>(null);
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load project on mount if not in store
    useEffect(() => {
        if (!project && id) {
            void loadProjects();
        }
    }, [id, project, loadProjects]);

    // Sync project name from store when project loads
    useEffect(() => {
        if (project) {
            setProjectName(project.name);
            setCurrentCode(project.code);
        }
    }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // -----------------------------------------------------------------
    // Auto-save
    // -----------------------------------------------------------------

    const saveProject = useCallback(
        async (code: string) => {
            if (!id) return;

            try {
                const compositionSettings = detectCompositionSettings(code);
                await updateProject(id, {
                    code,
                    ...compositionSettings,
                });
                setIsSaved(true);
            } catch (error: unknown) {
                if (AppError.is(error)) {
                    // eslint-disable-next-line no-console
                    console.error('[ProjectEditor] Auto-save failed:', error.message);
                }
            }
        },
        [id, updateProject],
    );

    const scheduleAutoSave = useCallback(
        (code: string) => {
            setIsSaved(false);
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
            autoSaveTimerRef.current = setTimeout(() => {
                void saveProject(code);
            }, AUTO_SAVE_DEBOUNCE_MS);
        },
        [saveProject],
    );

    // Cleanup auto-save timer
    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, []);

    // -----------------------------------------------------------------
    // Editor callbacks
    // -----------------------------------------------------------------

    const handleCodeChange = useCallback(
        (code: string) => {
            setCurrentCode(code);
            scheduleAutoSave(code);
        },
        [scheduleAutoSave],
    );

    const handleError = useCallback((newMarkers: EditorMarker[]) => {
        setMarkers(newMarkers);
    }, []);

    const handleEditorReady = useCallback(() => {
        setEditorReady(true);
    }, []);

    // -----------------------------------------------------------------
    // Toolbar callbacks
    // -----------------------------------------------------------------

    const handleUndo = useCallback(() => {
        editorRef.current?.undo();
    }, []);

    const handleRedo = useCallback(() => {
        editorRef.current?.redo();
    }, []);

    const handleFormat = useCallback(() => {
        editorRef.current?.formatCode();
    }, []);

    const handlePaste = useCallback((text: string) => {
        // Set the pasted text as the entire code (replace)
        // In a full implementation, this would insert at cursor position
        editorRef.current?.setCode(text);
    }, []);

    const handleClear = useCallback(() => {
        Alert.alert('Clear Code', 'This will clear all code. Continue?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear',
                style: 'destructive',
                onPress: () => {
                    editorRef.current?.setCode('');
                    setCurrentCode('');
                    scheduleAutoSave('');
                },
            },
        ]);
    }, [scheduleAutoSave]);

    const handleFontSizeChange = useCallback((size: number) => {
        editorRef.current?.setFontSize(size);
    }, []);

    const handleLineNumbersToggle = useCallback((enabled: boolean) => {
        editorRef.current?.setLineNumbers(enabled);
    }, []);

    const handleWordWrapToggle = useCallback((enabled: boolean) => {
        editorRef.current?.setWordWrap(enabled);
    }, []);

    const handleGoToLine = useCallback((line: number) => {
        editorRef.current?.revealLine(line);
    }, []);

    // -----------------------------------------------------------------
    // Preview callbacks
    // -----------------------------------------------------------------

    const handlePreviewFrameUpdate = useCallback((frame: number) => {
        setPreviewFrame(frame);
    }, []);

    const handlePreviewError = useCallback((message: string) => {
        setPreviewError(message);
    }, []);

    const handlePreviewReady = useCallback(() => {
        setPreviewReady(true);
        setPreviewError(null);
    }, []);

    const handlePlaybackStateChange = useCallback((playing: boolean) => {
        setIsPlaying(playing);
    }, []);

    const handleTogglePlay = useCallback(() => {
        if (isPlaying) {
            previewRef.current?.pause();
        } else {
            previewRef.current?.play();
        }
    }, [isPlaying]);

    const handleSeek = useCallback((frame: number) => {
        previewRef.current?.seek(frame);
        setPreviewFrame(frame);
    }, []);

    const handleSpeedChange = useCallback((speed: PlaybackSpeed) => {
        setPlaybackSpeed(speed);
        previewRef.current?.setSpeed(speed);
    }, []);

    const handleToggleLoop = useCallback(() => {
        const newLoop = !isLooping;
        setIsLooping(newLoop);
        previewRef.current?.toggleLoop(newLoop);
    }, [isLooping]);

    const handleResolutionChange = useCallback((key: PreviewResolutionKey) => {
        setPreviewResolution(key);
        previewRef.current?.setResolution(key);
    }, []);

    const handleSwitchToCode = useCallback(() => {
        setActiveTab('code');
    }, []);

    // -----------------------------------------------------------------
    // Export callbacks
    // -----------------------------------------------------------------

    const [renderSnackVisible, setRenderSnackVisible] = useState(false);

    const handleRenderQueued = useCallback((jobId: string) => {
        setRenderSnackVisible(true);
        // Navigate to the render progress screen
        router.push(`/render/${jobId}` as never);
    }, [router]);

    // -----------------------------------------------------------------
    // Name editing
    // -----------------------------------------------------------------

    const handleNameSubmit = useCallback(async () => {
        setIsEditingName(false);
        const trimmed = projectName.trim();
        if (!trimmed || !id || trimmed === project?.name) return;

        try {
            await updateProject(id, { name: trimmed });
        } catch (error: unknown) {
            if (AppError.is(error)) {
                Alert.alert('Error', 'Failed to rename project');
            }
        }
    }, [id, project?.name, projectName, updateProject]);

    // -----------------------------------------------------------------
    // Error badge count
    // -----------------------------------------------------------------

    const errorCount = useMemo(
        () => markers.filter((m) => m.severity === 'error').length,
        [markers],
    );

    // -----------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------

    if (!id) {
        return (
            <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
                <Text variant="bodyLarge" style={{ color: theme.colors.error }}>
                    Missing project ID
                </Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]} testID="project-editor">
            {/* ---------------------------------------------------------- */}
            {/* Top bar                                                     */}
            {/* ---------------------------------------------------------- */}
            <Appbar.Header
                style={{ backgroundColor: theme.colors.surface }}
                statusBarHeight={0}
            >
                <Appbar.BackAction onPress={() => router.back()} testID="editor-back" />

                {isEditingName ? (
                    <TextInput
                        value={projectName}
                        onChangeText={setProjectName}
                        onBlur={() => void handleNameSubmit()}
                        onSubmitEditing={() => void handleNameSubmit()}
                        autoFocus
                        dense
                        mode="flat"
                        style={[styles.nameInput, { color: theme.colors.onSurface }]}
                        underlineColor="transparent"
                        activeUnderlineColor={theme.colors.primary}
                        testID="editor-name-input"
                    />
                ) : (
                    <Appbar.Content
                        title={
                            <View style={styles.titleRow}>
                                <Text
                                    variant="titleMedium"
                                    numberOfLines={1}
                                    style={{ color: theme.colors.onSurface, flex: 1 }}
                                    onPress={() => setIsEditingName(true)}
                                    testID="editor-project-name"
                                >
                                    {projectName || 'Untitled'}
                                </Text>
                                {!isSaved && (
                                    <Badge
                                        size={8}
                                        style={[styles.unsavedDot, { backgroundColor: theme.colors.error }]}
                                        testID="editor-unsaved-dot"
                                    />
                                )}
                            </View>
                        }
                    />
                )}

                <Appbar.Action
                    icon="content-save"
                    onPress={() => void saveProject(currentCode)}
                    disabled={isSaved}
                    testID="editor-save"
                />
            </Appbar.Header>

            {/* ---------------------------------------------------------- */}
            {/* Tab bar                                                     */}
            {/* ---------------------------------------------------------- */}
            <View style={[styles.tabBar, { backgroundColor: theme.colors.surface }]}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabScrollContent}
                >
                    <SegmentedButtons
                        value={activeTab}
                        onValueChange={(val) => setActiveTab(val as TabValue)}
                        buttons={TAB_BUTTONS.map((tab) => ({
                            value: tab.value,
                            label: tab.label,
                            icon: tab.icon,
                            disabled: false,
                            testID: `editor-tab-${tab.value}`,
                        }))}
                        density="small"
                        style={styles.segmented}
                    />
                </ScrollView>
                {errorCount > 0 && (
                    <Badge
                        size={16}
                        style={[styles.errorBadge, { backgroundColor: theme.colors.error }]}
                        testID="editor-error-badge"
                    >
                        {errorCount}
                    </Badge>
                )}
            </View>

            {/* ---------------------------------------------------------- */}
            {/* Tab content                                                 */}
            {/* ---------------------------------------------------------- */}
            {activeTab === 'code' && (
                <>
                    <EditorToolbar
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        onFormat={handleFormat}
                        onCopyAll={() => currentCode}
                        onPaste={handlePaste}
                        onClear={handleClear}
                        onFontSizeChange={handleFontSizeChange}
                        onLineNumbersToggle={handleLineNumbersToggle}
                        onWordWrapToggle={handleWordWrapToggle}
                        currentCode={currentCode}
                        testID="editor-toolbar"
                    />
                    <CodeEditor
                        ref={editorRef}
                        initialCode={project?.code ?? ''}
                        onChange={handleCodeChange}
                        onError={handleError}
                        onReady={handleEditorReady}
                        testID="code-editor"
                    />
                    <ErrorPanel
                        markers={markers}
                        onGoToLine={handleGoToLine}
                        testID="error-panel"
                    />
                </>
            )}

            {activeTab === 'preview' && (
                <>
                    {previewError && (
                        <View style={[styles.previewErrorBanner, { backgroundColor: theme.colors.errorContainer }]}>
                            <Icon source="alert-circle-outline" size={20} color={theme.colors.error} />
                            <View style={styles.previewErrorContent}>
                                <Text
                                    variant="bodySmall"
                                    numberOfLines={2}
                                    style={{ color: theme.colors.error }}
                                >
                                    {previewError}
                                </Text>
                            </View>
                            <Text
                                variant="labelSmall"
                                style={[styles.editCodeLink, { color: theme.colors.primary }]}
                                onPress={handleSwitchToCode}
                                testID="preview-edit-code"
                            >
                                Edit Code
                            </Text>
                        </View>
                    )}
                    <ResolutionSelector
                        selectedResolution={previewResolution}
                        onResolutionChange={handleResolutionChange}
                        testID="preview-resolution"
                    />
                    <PreviewPlayer
                        ref={previewRef}
                        code={currentCode}
                        compositionWidth={project?.compositionWidth ?? 1920}
                        compositionHeight={project?.compositionHeight ?? 1080}
                        fps={project?.fps ?? 30}
                        durationInFrames={project?.durationInFrames ?? 150}
                        onFrameUpdate={handlePreviewFrameUpdate}
                        onError={handlePreviewError}
                        onReady={handlePreviewReady}
                        onPlaybackStateChange={handlePlaybackStateChange}
                        testID="preview-player"
                    />
                    <PlaybackControls
                        currentFrame={previewFrame}
                        durationInFrames={project?.durationInFrames ?? 150}
                        fps={project?.fps ?? 30}
                        isPlaying={isPlaying}
                        playbackSpeed={playbackSpeed}
                        isLooping={isLooping}
                        onTogglePlay={handleTogglePlay}
                        onSeek={handleSeek}
                        onSpeedChange={handleSpeedChange}
                        onToggleLoop={handleToggleLoop}
                        testID="playback-controls"
                    />
                </>
            )}

            {activeTab === 'export' && (
                <ScrollView style={styles.exportScroll} contentContainerStyle={styles.exportScrollContent}>
                    <ExportSettings
                        projectId={id}
                        projectName={projectName}
                        code={currentCode}
                        compositionWidth={project?.compositionWidth ?? 1920}
                        compositionHeight={project?.compositionHeight ?? 1080}
                        fps={project?.fps ?? 30}
                        durationInFrames={project?.durationInFrames ?? 150}
                        onRenderQueued={handleRenderQueued}
                        testID="export-settings"
                    />
                </ScrollView>
            )}

            {activeTab === 'variables' && (
                <VariablesTab testID="variables-tab" />
            )}

            {activeTab === 'assets' && (
                <AssetsTab
                    projectId={id}
                    testID="assets-tab"
                />
            )}

            {/* Render queued snackbar */}
            <Snackbar
                visible={renderSnackVisible}
                onDismiss={() => setRenderSnackVisible(false)}
                duration={4000}
                action={{
                    label: 'View Renders',
                    onPress: () => router.push('/(tabs)' as never),
                }}
                testID="render-queued-snackbar"
            >
                Render queued successfully!
            </Snackbar>
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
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nameInput: {
        flex: 1,
        backgroundColor: 'transparent',
        fontSize: 18,
        height: 40,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    unsavedDot: {
        marginLeft: spacing.xs,
    },
    tabBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    tabScrollContent: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        minWidth: '100%',
        alignItems: 'center',
    },
    segmented: {
        // Remove flex: 1 so it wraps naturally
    },
    errorBadge: {
        position: 'absolute',
        top: 2,
        right: spacing.sm,
    },
    placeholder: {
        marginTop: spacing.md,
    },
    previewErrorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    previewErrorContent: {
        flex: 1,
    },
    editCodeLink: {
        fontWeight: '600',
    },
    exportScroll: {
        flex: 1,
    },
    exportScrollContent: {
        flexGrow: 1,
    },
});
