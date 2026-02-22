/**
 * Asset thumbnail grid.
 *
 * Displays assets in a 3-column FlatList with thumbnails,
 * file name, size badge, and type icon overlay.
 * Long-press opens context menu (Copy URL, Delete, Preview).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Menu, Text } from 'react-native-paper';
import type { Asset } from '@renderflow/shared';
import { useAppTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import { formatFileSize, assetTypeIcon } from '../../utils/assetUploader';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AssetGridProps {
    assets: Asset[];
    onAssetPress?: (asset: Asset) => void;
    onCopyUrl?: (asset: Asset) => void;
    onDelete?: (asset: Asset) => void;
    onPreview?: (asset: Asset) => void;
    isLoading?: boolean;
    onRefresh?: () => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Grid cell
// ---------------------------------------------------------------------------

const NUM_COLUMNS = 3;
const CELL_GAP = spacing.xs;

interface AssetCellProps {
    asset: Asset;
    onPress?: (asset: Asset) => void;
    onCopyUrl?: (asset: Asset) => void;
    onDelete?: (asset: Asset) => void;
    onPreview?: (asset: Asset) => void;
    testID?: string;
}

function AssetCell({ asset, onPress, onCopyUrl, onDelete, onPreview, testID }: AssetCellProps) {
    const theme = useAppTheme();
    const [menuVisible, setMenuVisible] = useState(false);

    const isImage = asset.type === 'image';
    const thumbnailUri = asset.localUri ?? asset.remoteUrl;
    const iconName = assetTypeIcon(asset.type);

    const handlePress = useCallback(() => {
        onPress?.(asset);
    }, [asset, onPress]);

    const handleLongPress = useCallback(() => {
        setMenuVisible(true);
    }, []);

    return (
        <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
                <Pressable
                    onPress={handlePress}
                    onLongPress={handleLongPress}
                    style={[styles.cell, { backgroundColor: theme.colors.surfaceVariant }]}
                    testID={testID}
                >
                    {/* Thumbnail or icon */}
                    {isImage && thumbnailUri ? (
                        <Image
                            source={{ uri: thumbnailUri }}
                            style={styles.thumbnail}
                            resizeMode="cover"
                            testID={testID ? `${testID}-image` : undefined}
                        />
                    ) : (
                        <View style={[styles.iconPlaceholder, { backgroundColor: theme.colors.surfaceDisabled }]}>
                            <Icon source={iconName} size={32} color={theme.colors.onSurfaceVariant} />
                        </View>
                    )}

                    {/* Type badge */}
                    <View style={[styles.typeBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                        <Icon source={iconName} size={12} color={theme.colors.onPrimaryContainer} />
                    </View>

                    {/* Info overlay */}
                    <View style={[styles.infoOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                        <Text
                            variant="labelSmall"
                            numberOfLines={1}
                            style={styles.assetName}
                        >
                            {asset.name}
                        </Text>
                        <Text variant="labelSmall" style={styles.assetSize}>
                            {formatFileSize(asset.fileSize)}
                        </Text>
                    </View>
                </Pressable>
            }
        >
            <Menu.Item
                onPress={() => {
                    setMenuVisible(false);
                    onPreview?.(asset);
                }}
                title="Preview"
                leadingIcon="eye"
                testID={testID ? `${testID}-menu-preview` : undefined}
            />
            <Menu.Item
                onPress={() => {
                    setMenuVisible(false);
                    onCopyUrl?.(asset);
                }}
                title="Copy URL"
                leadingIcon="content-copy"
                testID={testID ? `${testID}-menu-copy` : undefined}
            />
            <Menu.Item
                onPress={() => {
                    setMenuVisible(false);
                    onDelete?.(asset);
                }}
                title="Delete"
                leadingIcon="delete"
                testID={testID ? `${testID}-menu-delete` : undefined}
            />
        </Menu>
    );
}

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

export function AssetGrid({
    assets,
    onAssetPress,
    onCopyUrl,
    onDelete,
    onPreview,
    isLoading = false,
    onRefresh,
    testID,
}: AssetGridProps) {
    const keyExtractor = useCallback((item: Asset) => item.id, []);

    const renderItem = useCallback(
        ({ item, index }: { item: Asset; index: number }) => (
            <AssetCell
                asset={item}
                onPress={onAssetPress}
                onCopyUrl={onCopyUrl}
                onDelete={onDelete}
                onPreview={onPreview}
                testID={testID ? `${testID}-cell-${index}` : undefined}
            />
        ),
        [onAssetPress, onCopyUrl, onDelete, onPreview, testID],
    );

    const columnWrapperStyle = useMemo(
        () => ({ gap: CELL_GAP, paddingHorizontal: spacing.sm }),
        [],
    );

    return (
        <FlatList
            data={assets}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            numColumns={NUM_COLUMNS}
            columnWrapperStyle={columnWrapperStyle}
            contentContainerStyle={styles.listContent}
            refreshing={isLoading}
            onRefresh={onRefresh}
            testID={testID}
        />
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    cell: {
        flex: 1,
        aspectRatio: 1,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        marginBottom: CELL_GAP,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    iconPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    typeBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        borderRadius: 10,
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 6,
        paddingVertical: 3,
    },
    assetName: {
        color: '#fff',
        fontSize: 10,
    },
    assetSize: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 9,
    },
    listContent: {
        paddingVertical: spacing.sm,
    },
});
