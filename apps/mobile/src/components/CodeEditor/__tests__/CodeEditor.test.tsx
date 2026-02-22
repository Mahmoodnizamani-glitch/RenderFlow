/**
 * CodeEditor component tests.
 *
 * Verifies WebView renders, theme messaging, debounced onChange,
 * and ref method calls.
 */
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../theme';
import { CodeEditor } from '../CodeEditor';
import type { CodeEditorHandle } from '../CodeEditor';

function renderWithTheme(ui: React.ReactElement) {
    return render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);
}

describe('CodeEditor', () => {
    let editorRef: React.RefObject<CodeEditorHandle>;

    beforeEach(() => {
        jest.useFakeTimers();
        editorRef = React.createRef<CodeEditorHandle>();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('renders the WebView', () => {
        const { getByTestId } = renderWithTheme(
            <CodeEditor testID="editor" />,
        );
        expect(getByTestId('editor')).toBeTruthy();
    });

    it('renders loading indicator initially', () => {
        const { getByText } = renderWithTheme(
            <CodeEditor testID="editor" />,
        );
        expect(getByText('Loading editor…')).toBeTruthy();
    });

    it('exposes ref methods', () => {
        renderWithTheme(
            <CodeEditor ref={editorRef} testID="editor" />,
        );

        expect(editorRef.current).not.toBeNull();
        expect(typeof editorRef.current?.getCode).toBe('function');
        expect(typeof editorRef.current?.setCode).toBe('function');
        expect(typeof editorRef.current?.formatCode).toBe('function');
        expect(typeof editorRef.current?.undo).toBe('function');
        expect(typeof editorRef.current?.redo).toBe('function');
        expect(typeof editorRef.current?.setFontSize).toBe('function');
        expect(typeof editorRef.current?.setWordWrap).toBe('function');
        expect(typeof editorRef.current?.setLineNumbers).toBe('function');
        expect(typeof editorRef.current?.revealLine).toBe('function');
    });

    it('ref methods do not throw when called', () => {
        renderWithTheme(
            <CodeEditor ref={editorRef} testID="editor" />,
        );

        expect(() => editorRef.current?.getCode()).not.toThrow();
        expect(() => editorRef.current?.setCode('const x = 1;')).not.toThrow();
        expect(() => editorRef.current?.formatCode()).not.toThrow();
        expect(() => editorRef.current?.undo()).not.toThrow();
        expect(() => editorRef.current?.redo()).not.toThrow();
        expect(() => editorRef.current?.setFontSize(16)).not.toThrow();
        expect(() => editorRef.current?.setWordWrap(false)).not.toThrow();
        expect(() => editorRef.current?.setLineNumbers(false)).not.toThrow();
        expect(() => editorRef.current?.revealLine(5)).not.toThrow();
    });

    it('calls onChange after receiving code-change message (debounced)', () => {
        const onChange = jest.fn();
        const { getByTestId } = renderWithTheme(
            <CodeEditor onChange={onChange} testID="editor" />,
        );

        const webview = getByTestId('editor-webview');

        // Simulate a code-change message from the WebView
        act(() => {
            webview.props.onMessage?.({
                nativeEvent: {
                    data: JSON.stringify({
                        type: 'code-change',
                        payload: { code: 'const x = 1;' },
                    }),
                },
            });
        });

        // onChange should not fire immediately (debounced at 500ms)
        expect(onChange).not.toHaveBeenCalled();

        // After debounce period
        act(() => {
            jest.advanceTimersByTime(500);
        });

        expect(onChange).toHaveBeenCalledWith('const x = 1;');
    });

    it('calls onError when receiving error message', () => {
        const onError = jest.fn();
        const { getByTestId } = renderWithTheme(
            <CodeEditor onError={onError} testID="editor" />,
        );

        const webview = getByTestId('editor-webview');

        act(() => {
            webview.props.onMessage?.({
                nativeEvent: {
                    data: JSON.stringify({
                        type: 'error',
                        payload: {
                            markers: [
                                {
                                    message: 'Unknown variable',
                                    severity: 'error',
                                    startLine: 1,
                                    startColumn: 1,
                                    endLine: 1,
                                    endColumn: 5,
                                },
                            ],
                        },
                    }),
                },
            });
        });

        expect(onError).toHaveBeenCalledWith([
            expect.objectContaining({
                message: 'Unknown variable',
                severity: 'error',
                startLine: 1,
            }),
        ]);
    });

    it('calls onReady when receiving ready message', () => {
        const onReady = jest.fn();
        const { getByTestId } = renderWithTheme(
            <CodeEditor onReady={onReady} testID="editor" />,
        );

        const webview = getByTestId('editor-webview');

        act(() => {
            webview.props.onMessage?.({
                nativeEvent: {
                    data: JSON.stringify({ type: 'ready', payload: {} }),
                },
            });
        });

        expect(onReady).toHaveBeenCalledTimes(1);
    });

    it('ignores malformed messages', () => {
        const onChange = jest.fn();
        const { getByTestId } = renderWithTheme(
            <CodeEditor onChange={onChange} testID="editor" />,
        );

        const webview = getByTestId('editor-webview');

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

        act(() => {
            jest.advanceTimersByTime(1000);
        });

        expect(onChange).not.toHaveBeenCalled();
    });
});
