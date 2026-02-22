/**
 * PreviewPlayer — Remotion Player embedded in a WebView.
 *
 * Wraps the preview HTML bundle, handles code injection with debounce,
 * and provides ref methods for playback control.
 */
import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { useAppTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import {
    PreviewMessageSchema,
    createPreviewHostMessage,
    PREVIEW_RESOLUTIONS,
} from './previewBridge';
import type { PreviewMessage, PreviewResolutionKey } from './previewBridge';

// ---------------------------------------------------------------------------
// HTML source — loaded from bundled asset
// ---------------------------------------------------------------------------

import { PREVIEW_HTML } from './previewHtml';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CODE_INJECTION_DEBOUNCE_MS = 1000;
const VARIABLE_UPDATE_DEBOUNCE_MS = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreviewPlayerProps {
    /** User's Remotion code */
    code: string;
    /** Composition width in pixels */
    compositionWidth?: number;
    /** Composition height in pixels */
    compositionHeight?: number;
    /** Frames per second */
    fps?: number;
    /** Total duration in frames */
    durationInFrames?: number;
    /** Called when frame changes during playback */
    onFrameUpdate?: (frame: number) => void;
    /** Called when an error occurs in the preview */
    onError?: (message: string, stack?: string) => void;
    /** Called when the preview WebView is ready */
    onReady?: () => void;
    /** Called when playback state changes */
    onPlaybackStateChange?: (isPlaying: boolean) => void;
    /** Variable values to inject into the preview sandbox */
    variables?: Record<string, unknown>;
    /** Test ID for testing */
    testID?: string;
}

export interface PreviewPlayerHandle {
    /** Start playback */
    play: () => void;
    /** Pause playback */
    pause: () => void;
    /** Seek to a specific frame */
    seek: (frame: number) => void;
    /** Set preview resolution scale */
    setResolution: (key: PreviewResolutionKey) => void;
    /** Set playback speed */
    setSpeed: (rate: number) => void;
    /** Toggle loop mode */
    toggleLoop: (loop: boolean) => void;
    /** Force reload code into preview */
    loadCode: (code: string) => void;
    /** Update variable values in the preview sandbox */
    updateVariables: (variables: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PreviewPlayer = forwardRef<PreviewPlayerHandle, PreviewPlayerProps>(
    function PreviewPlayer(
        {
            code,
            compositionWidth = 1920,
            compositionHeight = 1080,
            fps = 30,
            durationInFrames = 150,
            onFrameUpdate,
            onError,
            onReady,
            onPlaybackStateChange,
            variables,
            testID = 'preview-player',
        },
        ref,
    ) {
        const theme = useAppTheme();
        const webViewRef = useRef<WebView>(null);
        const [isReady, setIsReady] = useState(false);
        const [hasError, setHasError] = useState(false);
        const [errorText, setErrorText] = useState('');
        const codeInjectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const variableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const pendingCodeRef = useRef<string>(code);
        const isReadyRef = useRef(false);

        // -----------------------------------------------------------------
        // Send message to WebView
        // -----------------------------------------------------------------

        const sendMessage = useCallback((message: string) => {
            webViewRef.current?.injectJavaScript(
                `window.postMessage(${JSON.stringify(message)}, '*'); true;`
            );
        }, []);

        // -----------------------------------------------------------------
        // Inject code into preview
        // -----------------------------------------------------------------

        const injectCode = useCallback(
            (codeToInject: string) => {
                if (!isReadyRef.current) {
                    pendingCodeRef.current = codeToInject;
                    return;
                }
                sendMessage(
                    createPreviewHostMessage('load-code', {
                        code: codeToInject,
                        compositionWidth,
                        compositionHeight,
                        fps,
                        durationInFrames,
                    }),
                );
                setHasError(false);
                setErrorText('');
            },
            [compositionWidth, compositionHeight, fps, durationInFrames, sendMessage],
        );

        // -----------------------------------------------------------------
        // Debounced code injection on code changes
        // -----------------------------------------------------------------

        useEffect(() => {
            if (!isReady) {
                pendingCodeRef.current = code;
                return;
            }

            if (codeInjectionTimerRef.current) {
                clearTimeout(codeInjectionTimerRef.current);
            }

            codeInjectionTimerRef.current = setTimeout(() => {
                injectCode(code);
            }, CODE_INJECTION_DEBOUNCE_MS);

            return () => {
                if (codeInjectionTimerRef.current) {
                    clearTimeout(codeInjectionTimerRef.current);
                }
            };
        }, [code, isReady, injectCode]);

        // -----------------------------------------------------------------
        // Debounced variable injection on variable changes
        // -----------------------------------------------------------------

        const injectVariables = useCallback(
            (vars: Record<string, unknown>) => {
                if (!isReadyRef.current) return;
                sendMessage(
                    createPreviewHostMessage('update-variables', {
                        variables: vars,
                    }),
                );
            },
            [sendMessage],
        );

        useEffect(() => {
            if (!isReady || !variables) return;

            if (variableTimerRef.current) {
                clearTimeout(variableTimerRef.current);
            }

            variableTimerRef.current = setTimeout(() => {
                injectVariables(variables);
            }, VARIABLE_UPDATE_DEBOUNCE_MS);

            return () => {
                if (variableTimerRef.current) {
                    clearTimeout(variableTimerRef.current);
                }
            };
        }, [variables, isReady, injectVariables]);

        // -----------------------------------------------------------------
        // Ref methods
        // -----------------------------------------------------------------

        useImperativeHandle(ref, () => ({
            play: () => {
                sendMessage(createPreviewHostMessage('play', {}));
            },
            pause: () => {
                sendMessage(createPreviewHostMessage('pause', {}));
            },
            seek: (frame: number) => {
                sendMessage(createPreviewHostMessage('seek', { frame }));
            },
            setResolution: (key: PreviewResolutionKey) => {
                const resolution = PREVIEW_RESOLUTIONS[key];
                sendMessage(createPreviewHostMessage('set-resolution', { scale: resolution.scale }));
            },
            setSpeed: (rate: number) => {
                sendMessage(createPreviewHostMessage('set-speed', { rate }));
            },
            toggleLoop: (loop: boolean) => {
                sendMessage(createPreviewHostMessage('toggle-loop', { loop }));
            },
            loadCode: (newCode: string) => {
                injectCode(newCode);
            },
            updateVariables: (vars: Record<string, unknown>) => {
                injectVariables(vars);
            },
        }), [sendMessage, injectCode, injectVariables]);

        // -----------------------------------------------------------------
        // Handle messages from WebView
        // -----------------------------------------------------------------

        const handleMessage = useCallback(
            (event: WebViewMessageEvent) => {
                let parsed: PreviewMessage;
                try {
                    const raw = JSON.parse(event.nativeEvent.data) as unknown;
                    const result = PreviewMessageSchema.safeParse(raw);
                    if (!result.success) return;
                    parsed = result.data;
                } catch {
                    return;
                }

                switch (parsed.type) {
                    case 'ready':
                        setIsReady(true);
                        isReadyRef.current = true;
                        // Inject pending code
                        if (pendingCodeRef.current) {
                            injectCode(pendingCodeRef.current);
                        }
                        onReady?.();
                        break;

                    case 'frame-update':
                        onFrameUpdate?.(parsed.payload.frame);
                        break;

                    case 'error':
                        setHasError(true);
                        setErrorText(parsed.payload.message);
                        onError?.(parsed.payload.message, parsed.payload.stack);
                        break;

                    case 'playback-state':
                        onPlaybackStateChange?.(parsed.payload.isPlaying);
                        break;
                }
            },
            [injectCode, onError, onFrameUpdate, onPlaybackStateChange, onReady],
        );

        // -----------------------------------------------------------------
        // Cleanup
        // -----------------------------------------------------------------

        useEffect(() => {
            return () => {
                if (codeInjectionTimerRef.current) {
                    clearTimeout(codeInjectionTimerRef.current);
                }
            };
        }, []);

        // -----------------------------------------------------------------
        // Render
        // -----------------------------------------------------------------

        return (
            <View style={styles.container} testID={testID}>
                {!isReady && (
                    <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text
                            variant="bodyMedium"
                            style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}
                        >
                            Loading preview…
                        </Text>
                    </View>
                )}

                {hasError && isReady && (
                    <View
                        style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}
                        testID={`${testID}-error`}
                    >
                        <Icon source="alert-circle-outline" size={16} color={theme.colors.error} />
                        <Text
                            variant="bodySmall"
                            numberOfLines={2}
                            style={[styles.errorText, { color: theme.colors.error }]}
                        >
                            {errorText || 'Preview error'}
                        </Text>
                    </View>
                )}

                <WebView
                    ref={webViewRef}
                    source={{ html: PREVIEW_HTML }}
                    style={[styles.webview, { opacity: isReady ? 1 : 0 }]}
                    originWhitelist={['*']}
                    javaScriptEnabled
                    domStorageEnabled
                    onMessage={handleMessage}
                    scrollEnabled={false}
                    bounces={false}
                    overScrollMode="never"
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    allowsInlineMediaPlayback
                    mediaPlaybackRequiresUserAction={false}
                    // Security: restrict device API access
                    allowsFullscreenVideo={false}
                    geolocationEnabled={false}
                    testID={`${testID}-webview`}
                />
            </View>
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
        backgroundColor: '#121212',
    },
    loading: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: spacing.md,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        zIndex: 2,
    },
    errorText: {
        flex: 1,
    },
});
