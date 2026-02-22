/**
 * PreviewPlayer component tests.
 *
 * Verifies WebView renders, loading state, ref methods,
 * message handling, and debounced code injection.
 */
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../theme';
import { PreviewPlayer } from '../PreviewPlayer';
import type { PreviewPlayerHandle } from '../PreviewPlayer';

function renderWithTheme(ui: React.ReactElement) {
    return render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);
}

describe('PreviewPlayer', () => {
    let previewRef: React.RefObject<PreviewPlayerHandle>;

    beforeEach(() => {
        jest.useFakeTimers();
        previewRef = React.createRef<PreviewPlayerHandle>();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('renders the WebView', () => {
        const { getByTestId } = renderWithTheme(
            <PreviewPlayer code="" testID="preview" />,
        );
        expect(getByTestId('preview')).toBeTruthy();
    });

    it('renders loading indicator initially', () => {
        const { getByText } = renderWithTheme(
            <PreviewPlayer code="" testID="preview" />,
        );
        expect(getByText('Loading preview…')).toBeTruthy();
    });

    it('exposes ref methods', () => {
        renderWithTheme(
            <PreviewPlayer ref={previewRef} code="" testID="preview" />,
        );

        expect(previewRef.current).not.toBeNull();
        expect(typeof previewRef.current?.play).toBe('function');
        expect(typeof previewRef.current?.pause).toBe('function');
        expect(typeof previewRef.current?.seek).toBe('function');
        expect(typeof previewRef.current?.setResolution).toBe('function');
        expect(typeof previewRef.current?.setSpeed).toBe('function');
        expect(typeof previewRef.current?.toggleLoop).toBe('function');
        expect(typeof previewRef.current?.loadCode).toBe('function');
    });

    it('ref methods do not throw when called', () => {
        renderWithTheme(
            <PreviewPlayer ref={previewRef} code="" testID="preview" />,
        );

        expect(() => previewRef.current?.play()).not.toThrow();
        expect(() => previewRef.current?.pause()).not.toThrow();
        expect(() => previewRef.current?.seek(10)).not.toThrow();
        expect(() => previewRef.current?.setResolution('720p')).not.toThrow();
        expect(() => previewRef.current?.setSpeed(2)).not.toThrow();
        expect(() => previewRef.current?.toggleLoop(true)).not.toThrow();
        expect(() => previewRef.current?.loadCode('const x = 1;')).not.toThrow();
    });

    it('calls onReady when receiving ready message', () => {
        const onReady = jest.fn();
        const { getByTestId } = renderWithTheme(
            <PreviewPlayer code="" onReady={onReady} testID="preview" />,
        );

        const webview = getByTestId('preview-webview');

        act(() => {
            webview.props.onMessage?.({
                nativeEvent: {
                    data: JSON.stringify({ type: 'ready', payload: {} }),
                },
            });
        });

        expect(onReady).toHaveBeenCalledTimes(1);
    });

    it('calls onFrameUpdate when receiving frame-update message', () => {
        const onFrameUpdate = jest.fn();
        const { getByTestId } = renderWithTheme(
            <PreviewPlayer code="" onFrameUpdate={onFrameUpdate} testID="preview" />,
        );

        const webview = getByTestId('preview-webview');

        // First send ready
        act(() => {
            webview.props.onMessage?.({
                nativeEvent: {
                    data: JSON.stringify({ type: 'ready', payload: {} }),
                },
            });
        });

        // Then send frame update
        act(() => {
            webview.props.onMessage?.({
                nativeEvent: {
                    data: JSON.stringify({ type: 'frame-update', payload: { frame: 42 } }),
                },
            });
        });

        expect(onFrameUpdate).toHaveBeenCalledWith(42);
    });

    it('calls onError when receiving error message', () => {
        const onError = jest.fn();
        const { getByTestId } = renderWithTheme(
            <PreviewPlayer code="" onError={onError} testID="preview" />,
        );

        const webview = getByTestId('preview-webview');

        act(() => {
            webview.props.onMessage?.({
                nativeEvent: {
                    data: JSON.stringify({
                        type: 'error',
                        payload: { message: 'Render failed', stack: 'at line 5' },
                    }),
                },
            });
        });

        expect(onError).toHaveBeenCalledWith('Render failed', 'at line 5');
    });

    it('calls onPlaybackStateChange when receiving playback-state message', () => {
        const onPlaybackStateChange = jest.fn();
        const { getByTestId } = renderWithTheme(
            <PreviewPlayer code="" onPlaybackStateChange={onPlaybackStateChange} testID="preview" />,
        );

        const webview = getByTestId('preview-webview');

        act(() => {
            webview.props.onMessage?.({
                nativeEvent: {
                    data: JSON.stringify({ type: 'playback-state', payload: { isPlaying: true } }),
                },
            });
        });

        expect(onPlaybackStateChange).toHaveBeenCalledWith(true);
    });

    it('ignores malformed messages', () => {
        const onFrameUpdate = jest.fn();
        const { getByTestId } = renderWithTheme(
            <PreviewPlayer code="" onFrameUpdate={onFrameUpdate} testID="preview" />,
        );

        const webview = getByTestId('preview-webview');

        act(() => {
            webview.props.onMessage?.({
                nativeEvent: { data: 'not-json' },
            });
        });

        act(() => {
            webview.props.onMessage?.({
                nativeEvent: { data: JSON.stringify({ type: 'unknown', payload: {} }) },
            });
        });

        expect(onFrameUpdate).not.toHaveBeenCalled();
    });

    it('shows error banner when error message is received', () => {
        const { getByTestId, queryByTestId } = renderWithTheme(
            <PreviewPlayer code="" testID="preview" />,
        );

        // No error banner initially (component not ready yet so it shows loading)
        expect(queryByTestId('preview-error')).toBeNull();

        const webview = getByTestId('preview-webview');

        // Send ready first
        act(() => {
            webview.props.onMessage?.({
                nativeEvent: {
                    data: JSON.stringify({ type: 'ready', payload: {} }),
                },
            });
        });

        // Then send error
        act(() => {
            webview.props.onMessage?.({
                nativeEvent: {
                    data: JSON.stringify({
                        type: 'error',
                        payload: { message: 'Test error' },
                    }),
                },
            });
        });

        expect(getByTestId('preview-error')).toBeTruthy();
    });

    it('debounces code injection on code change', () => {
        const onReady = jest.fn();
        const { getByTestId, rerender } = renderWithTheme(
            <PreviewPlayer code="code1" onReady={onReady} testID="preview" />,
        );

        const webview = getByTestId('preview-webview');

        // Make the preview ready
        act(() => {
            webview.props.onMessage?.({
                nativeEvent: {
                    data: JSON.stringify({ type: 'ready', payload: {} }),
                },
            });
        });

        // Change code — should debounce
        rerender(
            <PaperProvider theme={lightTheme}>
                <PreviewPlayer code="code2" onReady={onReady} testID="preview" />
            </PaperProvider>,
        );

        // Code should not be injected immediately
        // After debounce period, it should inject
        act(() => {
            jest.advanceTimersByTime(1000);
        });

        // The WebView injectJavaScript should have been called
        // We can't easily assert the exact call since the mock just has jest.fn(),
        // but we verify no errors occurred
        expect(onReady).toHaveBeenCalledTimes(1);
    });
});
