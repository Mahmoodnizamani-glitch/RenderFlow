import React from 'react';
import { StyleSheet, View, ScrollView, Dimensions } from 'react-native';
import { Modal, Portal, Text, IconButton, Divider } from 'react-native-paper';
import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme';
import { spacing, radii } from '../theme/tokens';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export interface AppBottomSheetProps extends PropsWithChildren {
    visible: boolean;
    onDismiss: () => void;
    title?: string;
    maxHeight?: number;
    style?: StyleProp<ViewStyle>;
    testID?: string;
    accessibilityLabel?: string;
}

export function AppBottomSheet({
    visible,
    onDismiss,
    title,
    maxHeight = SCREEN_HEIGHT * 0.7,
    style,
    testID,
    accessibilityLabel,
    children,
}: AppBottomSheetProps) {
    const theme = useAppTheme();

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
                contentContainerStyle={[
                    styles.container,
                    { backgroundColor: theme.colors.surface, maxHeight },
                    style,
                ]}
                testID={testID}
            >
                <View
                    accessibilityLabel={accessibilityLabel ?? title}
                    accessibilityRole="summary"
                >
                    <View style={styles.handleBar}>
                        <View
                            style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]}
                        />
                    </View>

                    {title && (
                        <>
                            <View style={styles.header}>
                                <Text variant="titleMedium" style={styles.title}>
                                    {title}
                                </Text>
                                <IconButton
                                    icon="close"
                                    size={20}
                                    onPress={onDismiss}
                                    accessibilityLabel="Close bottom sheet"
                                    testID={testID ? `${testID}-close` : undefined}
                                />
                            </View>
                            <Divider />
                        </>
                    )}

                    <ScrollView
                        style={styles.scrollContent}
                        contentContainerStyle={styles.scrollContentContainer}
                        showsVerticalScrollIndicator={false}
                    >
                        {children}
                    </ScrollView>
                </View>
            </Modal>
        </Portal>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        overflow: 'hidden',
    },
    handleBar: {
        alignItems: 'center',
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: radii.full,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xs,
    },
    title: {
        fontWeight: '600',
        flex: 1,
    },
    scrollContent: {
        flexGrow: 0,
    },
    scrollContentContainer: {
        padding: spacing.lg,
    },
});
