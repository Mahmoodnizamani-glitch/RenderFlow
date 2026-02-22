/**
 * ImageInput — image picker for image-type variables.
 *
 * Uses expo-image-picker with camera + library support.
 * Displays a thumbnail preview of the selected image.
 */
import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '../../theme';
import { spacing } from '../../theme/tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageInputProps {
    name: string;
    label: string;
    value: string;
    onValueChange: (name: string, value: string) => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImageInput({
    name,
    label,
    value,
    onValueChange,
    testID = 'image-input',
}: ImageInputProps) {
    const theme = useAppTheme();
    const [pickError, setPickError] = useState<string | null>(null);

    const pickFromLibrary = useCallback(async () => {
        try {
            setPickError(null);
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                onValueChange(name, result.assets[0].uri);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to pick image';
            setPickError(message);
        }
    }, [name, onValueChange]);

    const pickFromCamera = useCallback(async () => {
        try {
            setPickError(null);
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                setPickError('Camera permission is required to take a photo.');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                onValueChange(name, result.assets[0].uri);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to take photo';
            setPickError(message);
        }
    }, [name, onValueChange]);

    const handleClear = useCallback(() => {
        onValueChange(name, '');
        setPickError(null);
    }, [name, onValueChange]);

    return (
        <View style={styles.container} testID={testID}>
            <Text
                variant="labelMedium"
                style={[styles.label, { color: theme.colors.onSurfaceVariant }]}
            >
                {label}
            </Text>

            {value ? (
                <View style={styles.previewContainer}>
                    <Image
                        source={{ uri: value }}
                        style={[styles.thumbnail, { borderColor: theme.colors.outline }]}
                        resizeMode="cover"
                        testID={`${testID}-thumbnail`}
                    />
                    <Button
                        mode="text"
                        onPress={handleClear}
                        compact
                        testID={`${testID}-clear`}
                    >
                        Remove
                    </Button>
                </View>
            ) : (
                <View
                    style={[
                        styles.placeholder,
                        {
                            borderColor: theme.colors.outline,
                            backgroundColor: theme.colors.surfaceVariant,
                        },
                    ]}
                    testID={`${testID}-placeholder`}
                >
                    <Icon
                        source="image-outline"
                        size={32}
                        color={theme.colors.onSurfaceVariant}
                    />
                    <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                    >
                        No image selected
                    </Text>
                </View>
            )}

            <View style={styles.buttonRow}>
                <Button
                    mode="outlined"
                    icon="image-multiple"
                    onPress={pickFromLibrary}
                    compact
                    style={styles.button}
                    testID={`${testID}-library`}
                >
                    Library
                </Button>
                <Button
                    mode="outlined"
                    icon="camera"
                    onPress={pickFromCamera}
                    compact
                    style={styles.button}
                    testID={`${testID}-camera`}
                >
                    Camera
                </Button>
            </View>

            {pickError && (
                <Text
                    variant="bodySmall"
                    style={[styles.error, { color: theme.colors.error }]}
                    testID={`${testID}-error`}
                >
                    {pickError}
                </Text>
            )}
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.sm,
    },
    label: {
        marginBottom: spacing.xs,
    },
    previewContainer: {
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    thumbnail: {
        width: 120,
        height: 120,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: spacing.xs,
    },
    placeholder: {
        height: 100,
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        marginBottom: spacing.xs,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    button: {
        flex: 1,
    },
    error: {
        marginTop: spacing.xs,
    },
});
