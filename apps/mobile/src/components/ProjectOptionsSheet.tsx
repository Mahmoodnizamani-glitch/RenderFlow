/**
 * Project options bottom sheet.
 *
 * Shows actions: Rename, Duplicate, Toggle Favorite, Delete, Export Code, Share.
 * Triggered by long-press on project cards.
 */
import React, { useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { List, Divider, TextInput, Button } from 'react-native-paper';
import type { Project } from '@renderflow/shared';
import { AppBottomSheet } from './AppBottomSheet';
import { ConfirmDialog } from './ConfirmDialog';
import { useAppTheme } from '../theme';
import { spacing, palette } from '../theme/tokens';

export interface ProjectOptionsSheetProps {
    visible: boolean;
    project: Project | null;
    onDismiss: () => void;
    onRename: (id: string, name: string) => void;
    onDuplicate: (id: string) => void;
    onToggleFavorite: (id: string) => void;
    onDelete: (id: string) => void;
    onExportCode?: (id: string) => void;
    onShare?: (id: string) => void;
    testID?: string;
}

export function ProjectOptionsSheet({
    visible,
    project,
    onDismiss,
    onRename,
    onDuplicate,
    onToggleFavorite,
    onDelete,
    onExportCode,
    onShare,
    testID,
}: ProjectOptionsSheetProps) {
    const theme = useAppTheme();
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleStartRename = useCallback(() => {
        if (project) {
            setRenameValue(project.name);
            setIsRenaming(true);
        }
    }, [project]);

    const handleConfirmRename = useCallback(() => {
        if (project && renameValue.trim()) {
            onRename(project.id, renameValue.trim());
            setIsRenaming(false);
            onDismiss();
        }
    }, [project, renameValue, onRename, onDismiss]);

    const handleCancelRename = useCallback(() => {
        setIsRenaming(false);
    }, []);

    const handleDuplicate = useCallback(() => {
        if (project) {
            onDuplicate(project.id);
            onDismiss();
        }
    }, [project, onDuplicate, onDismiss]);

    const handleToggleFavorite = useCallback(() => {
        if (project) {
            onToggleFavorite(project.id);
            onDismiss();
        }
    }, [project, onToggleFavorite, onDismiss]);

    const handleDeletePress = useCallback(() => {
        setShowDeleteConfirm(true);
    }, []);

    const handleConfirmDelete = useCallback(() => {
        if (project) {
            onDelete(project.id);
            setShowDeleteConfirm(false);
            onDismiss();
        }
    }, [project, onDelete, onDismiss]);

    const handleCancelDelete = useCallback(() => {
        setShowDeleteConfirm(false);
    }, []);

    const handleExport = useCallback(() => {
        if (project && onExportCode) {
            onExportCode(project.id);
            onDismiss();
        }
    }, [project, onExportCode, onDismiss]);

    const handleShare = useCallback(() => {
        if (project && onShare) {
            onShare(project.id);
            onDismiss();
        }
    }, [project, onShare, onDismiss]);

    // Reset state when sheet closes
    const handleDismiss = useCallback(() => {
        setIsRenaming(false);
        setShowDeleteConfirm(false);
        onDismiss();
    }, [onDismiss]);

    if (!project) return null;

    return (
        <>
            <AppBottomSheet
                visible={visible && !showDeleteConfirm}
                onDismiss={handleDismiss}
                title={isRenaming ? 'Rename Project' : project.name}
                testID={testID}
            >
                {isRenaming ? (
                    <View style={styles.renameContainer}>
                        <TextInput
                            mode="outlined"
                            label="Project Name"
                            value={renameValue}
                            onChangeText={setRenameValue}
                            autoFocus
                            testID={testID ? `${testID}-rename-input` : undefined}
                            style={styles.renameInput}
                        />
                        <View style={styles.renameActions}>
                            <Button onPress={handleCancelRename}>Cancel</Button>
                            <Button
                                mode="contained"
                                onPress={handleConfirmRename}
                                disabled={!renameValue.trim()}
                                testID={testID ? `${testID}-rename-confirm` : undefined}
                            >
                                Rename
                            </Button>
                        </View>
                    </View>
                ) : (
                    <View>
                        <List.Item
                            title="Rename"
                            left={(props) => <List.Icon {...props} icon="pencil-outline" />}
                            onPress={handleStartRename}
                            testID={testID ? `${testID}-rename` : undefined}
                        />
                        <List.Item
                            title="Duplicate"
                            left={(props) => <List.Icon {...props} icon="content-copy" />}
                            onPress={handleDuplicate}
                            testID={testID ? `${testID}-duplicate` : undefined}
                        />
                        <List.Item
                            title={project.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                            left={(props) => (
                                <List.Icon
                                    {...props}
                                    icon={project.isFavorite ? 'star' : 'star-outline'}
                                    color={project.isFavorite ? palette.warning : undefined}
                                />
                            )}
                            onPress={handleToggleFavorite}
                            testID={testID ? `${testID}-favorite` : undefined}
                        />
                        <Divider />
                        {onExportCode && (
                            <List.Item
                                title="Export Code"
                                left={(props) => <List.Icon {...props} icon="code-tags" />}
                                onPress={handleExport}
                                testID={testID ? `${testID}-export` : undefined}
                            />
                        )}
                        {onShare && (
                            <List.Item
                                title="Share"
                                left={(props) => <List.Icon {...props} icon="share-variant-outline" />}
                                onPress={handleShare}
                                testID={testID ? `${testID}-share` : undefined}
                            />
                        )}
                        <Divider />
                        <List.Item
                            title="Delete"
                            titleStyle={{ color: theme.colors.error }}
                            left={(props) => (
                                <List.Icon {...props} icon="trash-can-outline" color={theme.colors.error} />
                            )}
                            onPress={handleDeletePress}
                            testID={testID ? `${testID}-delete` : undefined}
                        />
                    </View>
                )}
            </AppBottomSheet>

            <ConfirmDialog
                visible={showDeleteConfirm}
                title="Delete Project"
                message={`Are you sure you want to delete "${project.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                destructive
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                testID={testID ? `${testID}-delete-confirm` : undefined}
            />
        </>
    );
}

const styles = StyleSheet.create({
    renameContainer: {
        gap: spacing.lg,
    },
    renameInput: {
        marginBottom: spacing.sm,
    },
    renameActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
    },
});
