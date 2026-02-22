/**
 * Reusable confirmation dialog.
 *
 * Wraps React Native Paper's Dialog with a standard confirmation UI:
 * title, message, confirm/cancel buttons.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { Dialog, Portal, Text, Button } from 'react-native-paper';
import { spacing } from '../theme/tokens';

export interface ConfirmDialogProps {
    visible: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    testID?: string;
}

export function ConfirmDialog({
    visible,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    onConfirm,
    onCancel,
    testID,
}: ConfirmDialogProps) {
    return (
        <Portal>
            <Dialog
                visible={visible}
                onDismiss={onCancel}
                testID={testID}
                style={styles.dialog}
            >
                <Dialog.Title>{title}</Dialog.Title>
                <Dialog.Content>
                    <Text variant="bodyMedium">{message}</Text>
                </Dialog.Content>
                <Dialog.Actions style={styles.actions}>
                    <Button
                        onPress={onCancel}
                        testID={testID ? `${testID}-cancel` : undefined}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        onPress={onConfirm}
                        textColor={destructive ? '#E17055' : undefined}
                        testID={testID ? `${testID}-confirm` : undefined}
                    >
                        {confirmLabel}
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
}

const styles = StyleSheet.create({
    dialog: {
        borderRadius: 16,
    },
    actions: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
    },
});
