/**
 * Asset preview bottom sheet.
 *
 * Full-screen preview for different asset types:
 * - Images: full-size display
 * - Video/Audio: file info display
 * - Fonts: sample text display
 *
 * Shows metadata and Copy URL / Delete actions.
 */
import React from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Divider, Icon, Text } from 'react-native-paper';
import type { Asset } from '@renderflow/shared';
import { useAppTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import { formatFileSize, assetTypeIcon, assetTypeLabel } from '../../utils/assetUploader';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AssetPreviewSheetProps {
    asset: Asset;
    visible: boolean;
    onDismiss: () => void;
    onCopyUrl: (asset: Asset) => void;
    onDelete: (asset: Asset) => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssetPreviewSheet({
    asset,
    visible,
    onDismiss,
    onCopyUrl,
    onDelete,
    testID,
}: AssetPreviewSheetProps) {
    const theme = useAppTheme();

    if (!visible) return null;

    const previewUri = asset.localUri ?? asset.remoteUrl;
    const iconName = assetTypeIcon(asset.type);
    const typeLabel = assetTypeLabel(asset.type);

    return (
        <View
            style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            testID={testID}
        >
            <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text variant="titleMedium" numberOfLines={1} style={{ flex: 1 }}>
                        {asset.name}
                    </Text>
                    <Button
                        mode="text"
                        onPress={onDismiss}
                        compact
                        testID={testID ? `${testID}-close` : undefined}
                    >
                        Close
                    </Button>
                </View>

                <Divider />

                {/* Preview area */}
                <ScrollView
                    style={styles.previewArea}
                    contentContainerStyle={styles.previewContent}
                >
                    {asset.type === 'image' && previewUri ? (
                        <Image
                            source={{ uri: previewUri }}
                            style={styles.imagePreview}
                            resizeMode="contain"
                            testID={testID ? `${testID}-image` : undefined}
                        />
                    ) : asset.type === 'font' ? (
                        <View style={styles.fontPreview}>
                            <Icon source="format-font" size={48} color={theme.colors.primary} />
                            <Text variant="headlineMedium" style={{ color: theme.colors.onSurface, marginTop: spacing.md }}>
                                The quick brown fox
                            </Text>
                            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                                jumps over the lazy dog
                            </Text>
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: spacing.sm }}>
                                ABCDEFGHIJKLMNOPQRSTUVWXYZ
                            </Text>
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                abcdefghijklmnopqrstuvwxyz 0123456789
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.genericPreview}>
                            <Icon source={iconName} size={64} color={theme.colors.primary} />
                            <Text variant="bodyLarge" style={[styles.genericText, { color: theme.colors.onSurfaceVariant }]}>
                                {typeLabel} file
                            </Text>
                        </View>
                    )}
                </ScrollView>

                <Divider />

                {/* Metadata */}
                <View style={styles.metadata}>
                    <MetaRow label="Type" value={typeLabel} />
                    <MetaRow label="Size" value={formatFileSize(asset.fileSize)} />
                    <MetaRow label="MIME" value={asset.mimeType} />
                    <MetaRow label="Created" value={new Date(asset.createdAt).toLocaleDateString()} />
                    {asset.remoteUrl && (
                        <MetaRow label="URL" value={asset.remoteUrl} numberOfLines={1} />
                    )}
                </View>

                <Divider />

                {/* Actions */}
                <View style={styles.actions}>
                    <Button
                        mode="contained"
                        icon="content-copy"
                        onPress={() => onCopyUrl(asset)}
                        style={styles.actionButton}
                        testID={testID ? `${testID}-copy` : undefined}
                    >
                        Copy URL
                    </Button>
                    <Button
                        mode="outlined"
                        icon="delete"
                        textColor={theme.colors.error}
                        onPress={() => onDelete(asset)}
                        style={styles.actionButton}
                        testID={testID ? `${testID}-delete` : undefined}
                    >
                        Delete
                    </Button>
                </View>
            </View>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Meta row helper
// ---------------------------------------------------------------------------

interface MetaRowProps {
    label: string;
    value: string;
    numberOfLines?: number;
}

function MetaRow({ label, value, numberOfLines }: MetaRowProps) {
    const theme = useAppTheme();
    return (
        <View style={styles.metaRow}>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, width: 60 }}>
                {label}
            </Text>
            <Text
                variant="bodySmall"
                numberOfLines={numberOfLines}
                style={{ color: theme.colors.onSurface, flex: 1 }}
            >
                {value}
            </Text>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        gap: spacing.sm,
    },
    previewArea: {
        maxHeight: 300,
    },
    previewContent: {
        alignItems: 'center',
        padding: spacing.md,
    },
    imagePreview: {
        width: '100%',
        height: 280,
    },
    fontPreview: {
        alignItems: 'center',
        padding: spacing.md,
    },
    genericPreview: {
        alignItems: 'center',
        padding: spacing.xl,
    },
    genericText: {
        marginTop: spacing.md,
    },
    metadata: {
        padding: spacing.md,
    },
    metaRow: {
        flexDirection: 'row',
        marginBottom: spacing.xs,
    },
    actions: {
        flexDirection: 'row',
        padding: spacing.md,
        gap: spacing.sm,
    },
    actionButton: {
        flex: 1,
    },
});
