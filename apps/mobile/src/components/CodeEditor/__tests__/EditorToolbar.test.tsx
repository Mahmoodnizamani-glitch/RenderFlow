/**
 * EditorToolbar component tests.
 *
 * Verifies all toolbar buttons are rendered and fire correct callbacks.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../theme';
import { EditorToolbar } from '../EditorToolbar';

function renderWithTheme(ui: React.ReactElement) {
    return render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);
}

describe('EditorToolbar', () => {
    const defaultProps = {
        onUndo: jest.fn(),
        onRedo: jest.fn(),
        onFormat: jest.fn(),
        onCopyAll: jest.fn(() => 'test code'),
        onPaste: jest.fn(),
        onClear: jest.fn(),
        onFontSizeChange: jest.fn(),
        onLineNumbersToggle: jest.fn(),
        onWordWrapToggle: jest.fn(),
        currentCode: 'const x = 1;',
        testID: 'toolbar',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the toolbar container', () => {
        const { getByTestId } = renderWithTheme(
            <EditorToolbar {...defaultProps} />,
        );
        expect(getByTestId('toolbar')).toBeTruthy();
    });

    it('calls onUndo when undo button pressed', () => {
        const { getByTestId } = renderWithTheme(
            <EditorToolbar {...defaultProps} />,
        );
        fireEvent.press(getByTestId('toolbar-undo'));
        expect(defaultProps.onUndo).toHaveBeenCalledTimes(1);
    });

    it('calls onRedo when redo button pressed', () => {
        const { getByTestId } = renderWithTheme(
            <EditorToolbar {...defaultProps} />,
        );
        fireEvent.press(getByTestId('toolbar-redo'));
        expect(defaultProps.onRedo).toHaveBeenCalledTimes(1);
    });

    it('calls onFormat when format button pressed', () => {
        const { getByTestId } = renderWithTheme(
            <EditorToolbar {...defaultProps} />,
        );
        fireEvent.press(getByTestId('toolbar-format'));
        expect(defaultProps.onFormat).toHaveBeenCalledTimes(1);
    });

    it('calls onClear when clear button pressed', () => {
        const { getByTestId } = renderWithTheme(
            <EditorToolbar {...defaultProps} />,
        );
        fireEvent.press(getByTestId('toolbar-clear'));
        expect(defaultProps.onClear).toHaveBeenCalledTimes(1);
    });

    it('renders font size display', () => {
        const { getByText } = renderWithTheme(
            <EditorToolbar {...defaultProps} />,
        );
        expect(getByText('14')).toBeTruthy(); // Default font size
    });

    it('changes font size when A- pressed', () => {
        const { getByTestId, getByText } = renderWithTheme(
            <EditorToolbar {...defaultProps} />,
        );
        fireEvent.press(getByTestId('toolbar-font-decrease'));
        expect(defaultProps.onFontSizeChange).toHaveBeenCalledWith(13);
        expect(getByText('13')).toBeTruthy();
    });

    it('changes font size when A+ pressed', () => {
        const { getByTestId, getByText } = renderWithTheme(
            <EditorToolbar {...defaultProps} />,
        );
        fireEvent.press(getByTestId('toolbar-font-increase'));
        expect(defaultProps.onFontSizeChange).toHaveBeenCalledWith(15);
        expect(getByText('15')).toBeTruthy();
    });

    it('calls onLineNumbersToggle when line numbers button pressed', () => {
        const { getByTestId } = renderWithTheme(
            <EditorToolbar {...defaultProps} />,
        );
        fireEvent.press(getByTestId('toolbar-line-numbers'));
        expect(defaultProps.onLineNumbersToggle).toHaveBeenCalledWith(false);
    });

    it('calls onWordWrapToggle when word wrap button pressed', () => {
        const { getByTestId } = renderWithTheme(
            <EditorToolbar {...defaultProps} />,
        );
        fireEvent.press(getByTestId('toolbar-word-wrap'));
        expect(defaultProps.onWordWrapToggle).toHaveBeenCalledWith(false);
    });

    it('renders all accessibility labels', () => {
        const { getByLabelText } = renderWithTheme(
            <EditorToolbar {...defaultProps} />,
        );
        expect(getByLabelText('Undo')).toBeTruthy();
        expect(getByLabelText('Redo')).toBeTruthy();
        expect(getByLabelText('Format code')).toBeTruthy();
        expect(getByLabelText('Copy all code')).toBeTruthy();
        expect(getByLabelText('Paste')).toBeTruthy();
        expect(getByLabelText('Clear code')).toBeTruthy();
        expect(getByLabelText('Decrease font size')).toBeTruthy();
        expect(getByLabelText('Increase font size')).toBeTruthy();
        expect(getByLabelText('Toggle line numbers')).toBeTruthy();
        expect(getByLabelText('Toggle word wrap')).toBeTruthy();
    });
});
