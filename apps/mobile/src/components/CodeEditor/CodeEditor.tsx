/**
 * CodeEditor — Monaco Editor embedded in a WebView.
 *
 * Provides a full-featured code editor with syntax highlighting,
 * IntelliSense, error detection, and bidirectional React Native bridge.
 */
import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react';
import {
    Platform,
    StyleSheet,
    View,
    KeyboardAvoidingView,
} from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { useAppTheme } from '../../theme';
import {
    EditorMessageSchema,
    createHostMessage,
} from './editorBridge';
import type { EditorMarker, EditorMessage } from './editorBridge';

// ---------------------------------------------------------------------------
// HTML source — loaded from bundled asset
// ---------------------------------------------------------------------------

import { EDITOR_HTML } from './editorHtml';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeEditorProps {
    /** Initial code to display in the editor */
    initialCode?: string;
    /** Called when code changes (debounced at 500ms on the RN side) */
    onChange?: (code: string) => void;
    /** Called when editor reports diagnostic errors/warnings */
    onError?: (markers: EditorMarker[]) => void;
    /** Called when the editor is ready */
    onReady?: () => void;
    /** Whether the editor is read-only */
    readOnly?: boolean;
    /** Test ID for testing */
    testID?: string;
}

export interface CodeEditorHandle {
    /** Get the current code from the editor */
    getCode: () => void;
    /** Set code in the editor (preserves undo stack) */
    setCode: (code: string) => void;
    /** Trigger auto-format */
    formatCode: () => void;
    /** Undo the last edit */
    undo: () => void;
    /** Redo the last undone edit */
    redo: () => void;
    /** Set font size */
    setFontSize: (size: number) => void;
    /** Toggle word wrap */
    setWordWrap: (enabled: boolean) => void;
    /** Toggle line numbers */
    setLineNumbers: (enabled: boolean) => void;
    /** Scroll to a specific line */
    revealLine: (line: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ONCHANGE_DEBOUNCE_MS = 500;

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
    function CodeEditor(
        {
            initialCode = '',
            onChange,
            onError,
            onReady,
            readOnly = false,
            testID = 'code-editor',
        },
        ref,
    ) {
        const theme = useAppTheme();
        const webViewRef = useRef<WebView>(null);
        const [isReady, setIsReady] = useState(false);
        const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const pendingInitialCode = useRef<string>(initialCode);
        const isDark = theme.dark;

        // -----------------------------------------------------------------
        // Send message to WebView
        // -----------------------------------------------------------------

        const sendMessage = useCallback((message: string) => {
            webViewRef.current?.injectJavaScript(
                `window.postMessage(${JSON.stringify(message)}, '*'); true;`,
            );
        }, []);

        // -----------------------------------------------------------------
        // Ref methods
        // -----------------------------------------------------------------

        useImperativeHandle(ref, () => ({
            getCode: () => {
                sendMessage(createHostMessage('get-code', {}));
            },
            setCode: (code: string) => {
                sendMessage(createHostMessage('set-code', { code }));
            },
            formatCode: () => {
                sendMessage(createHostMessage('format', {}));
            },
            undo: () => {
                sendMessage(createHostMessage('undo', {}));
            },
            redo: () => {
                sendMessage(createHostMessage('redo', {}));
            },
            setFontSize: (size: number) => {
                sendMessage(createHostMessage('set-font-size', { size }));
            },
            setWordWrap: (enabled: boolean) => {
                sendMessage(createHostMessage('set-word-wrap', { enabled }));
            },
            setLineNumbers: (enabled: boolean) => {
                sendMessage(createHostMessage('set-line-numbers', { enabled }));
            },
            revealLine: (line: number) => {
                sendMessage(createHostMessage('reveal-line', { line }));
            },
        }), [sendMessage]);

        // -----------------------------------------------------------------
        // Theme sync
        // -----------------------------------------------------------------

        useEffect(() => {
            if (!isReady) return;
            sendMessage(
                createHostMessage('set-theme', { theme: isDark ? 'vs-dark' : 'vs' }),
            );
        }, [isDark, isReady, sendMessage]);

        // -----------------------------------------------------------------
        // ReadOnly sync
        // -----------------------------------------------------------------

        useEffect(() => {
            if (!isReady) return;
            sendMessage(createHostMessage('set-readonly', { readOnly }));
        }, [readOnly, isReady, sendMessage]);

        // -----------------------------------------------------------------
        // Handle messages from WebView
        // -----------------------------------------------------------------

        const handleMessage = useCallback(
            (event: WebViewMessageEvent) => {
                let parsed: EditorMessage;
                try {
                    const raw = JSON.parse(event.nativeEvent.data) as unknown;
                    const result = EditorMessageSchema.safeParse(raw);
                    if (!result.success) return;
                    parsed = result.data;
                } catch {
                    return;
                }

                switch (parsed.type) {
                    case 'ready':
                        setIsReady(true);
                        // Send initial code once editor is ready
                        if (pendingInitialCode.current) {
                            sendMessage(
                                createHostMessage('set-code', { code: pendingInitialCode.current }),
                            );
                        }
                        // Sync theme
                        sendMessage(
                            createHostMessage('set-theme', { theme: isDark ? 'vs-dark' : 'vs' }),
                        );
                        // Sync readOnly
                        if (readOnly) {
                            sendMessage(createHostMessage('set-readonly', { readOnly: true }));
                        }
                        onReady?.();
                        break;

                    case 'code-change':
                        // Debounce the onChange callback to avoid excessive updates
                        if (changeTimerRef.current) {
                            clearTimeout(changeTimerRef.current);
                        }
                        changeTimerRef.current = setTimeout(() => {
                            onChange?.(parsed.payload.code);
                        }, ONCHANGE_DEBOUNCE_MS);
                        break;

                    case 'error':
                        onError?.(parsed.payload.markers);
                        break;

                    case 'cursor':
                        // Cursor position tracking — can be extended later
                        break;
                }
            },
            [isDark, onChange, onError, onReady, readOnly, sendMessage],
        );

        // -----------------------------------------------------------------
        // Cleanup debounce timer
        // -----------------------------------------------------------------

        useEffect(() => {
            return () => {
                if (changeTimerRef.current) {
                    clearTimeout(changeTimerRef.current);
                }
            };
        }, []);

        // -----------------------------------------------------------------
        // Render
        // -----------------------------------------------------------------

        return (
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                testID={testID}
            >
                {!isReady && (
                    <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text
                            variant="bodyMedium"
                            style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}
                        >
                            Loading editor…
                        </Text>
                    </View>
                )}
                <WebView
                    ref={webViewRef}
                    source={{ html: EDITOR_HTML }}
                    style={[
                        styles.webview,
                        { opacity: isReady ? 1 : 0 },
                    ]}
                    originWhitelist={['*']}
                    javaScriptEnabled
                    domStorageEnabled
                    onMessage={handleMessage}
                    scrollEnabled={false}
                    bounces={false}
                    overScrollMode="never"
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    keyboardDisplayRequiresUserAction={false}
                    hideKeyboardAccessoryView={true}
                    allowsInlineMediaPlayback
                    mediaPlaybackRequiresUserAction={false}
                    // For Android to properly register touch events for focus:
                    androidLayerType="hardware"
                    // Force the webview to take focus when tapped
                    onTouchEnd={() => {
                        webViewRef.current?.requestFocus();
                    }}
                    testID={`${testID}-webview`}
                />
            </KeyboardAvoidingView>
        );
    },
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    loading: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
    },
});
