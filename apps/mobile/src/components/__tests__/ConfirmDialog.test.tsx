/**
 * ConfirmDialog component tests.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../theme';
import { ConfirmDialog } from '../ConfirmDialog';

function renderWithTheme(ui: React.ReactElement) {
    return render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);
}

describe('ConfirmDialog', () => {
    const defaultProps = {
        visible: true,
        title: 'Delete Item',
        message: 'Are you sure you want to delete this item?',
        onConfirm: jest.fn(),
        onCancel: jest.fn(),
        testID: 'test-dialog',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders title and message when visible', () => {
        const { getByText } = renderWithTheme(<ConfirmDialog {...defaultProps} />);
        expect(getByText('Delete Item')).toBeTruthy();
        expect(getByText('Are you sure you want to delete this item?')).toBeTruthy();
    });

    it('renders default confirm and cancel labels', () => {
        const { getByText } = renderWithTheme(<ConfirmDialog {...defaultProps} />);
        expect(getByText('Confirm')).toBeTruthy();
        expect(getByText('Cancel')).toBeTruthy();
    });

    it('renders custom button labels', () => {
        const { getByText } = renderWithTheme(
            <ConfirmDialog {...defaultProps} confirmLabel="Delete" cancelLabel="Keep" />,
        );
        expect(getByText('Delete')).toBeTruthy();
        expect(getByText('Keep')).toBeTruthy();
    });

    it('calls onConfirm when confirm button pressed', () => {
        const { getByTestId } = renderWithTheme(<ConfirmDialog {...defaultProps} />);
        fireEvent.press(getByTestId('test-dialog-confirm'));
        expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when cancel button pressed', () => {
        const { getByTestId } = renderWithTheme(<ConfirmDialog {...defaultProps} />);
        fireEvent.press(getByTestId('test-dialog-cancel'));
        expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not render dialog when not visible', () => {
        const { queryByText } = renderWithTheme(
            <ConfirmDialog {...defaultProps} visible={false} />,
        );
        expect(queryByText('Delete Item')).toBeNull();
    });
});
