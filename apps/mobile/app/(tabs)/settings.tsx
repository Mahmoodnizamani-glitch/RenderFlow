/**
 * Settings screen — subscription, usage, and account management.
 *
 * Sections:
 * - Subscription: current plan, renewal date, manage/upgrade
 * - Usage: credits, storage, daily renders
 * - Account: profile info, logout
 *
 * Guest mode: shows a simplified view with a sign-in CTA.
 */
import React, { useCallback, useEffect, useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, View, Linking, Platform } from 'react-native';
import {
    Button,
    Divider,
    Icon,
    List,
    ProgressBar,
    Surface,
    Text,
} from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useAppTheme } from '../../src/theme';
import { spacing, radii } from '../../src/theme/tokens';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { useSubscriptionStore } from '../../src/stores/useSubscriptionStore';
import {
    TIER_LIMITS,
    formatUsdCents,
    isUnlimited,
    SUBSCRIPTION_PRICING,
} from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const val = bytes / Math.pow(1024, i);
    return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

// ---------------------------------------------------------------------------
// Guest settings view
// ---------------------------------------------------------------------------

function GuestSettingsView() {
    const theme = useAppTheme();
    const router = useRouter();
    const logout = useAuthStore((s) => s.logout);

    const handleSignIn = useCallback(() => {
        void logout().then(() => {
            router.replace('/(auth)/login' as never);
        });
    }, [logout, router]);

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            contentContainerStyle={styles.content}
        >
            {/* Guest Mode Badge */}
            <Surface
                style={[styles.guestCard, { borderColor: theme.colors.outlineVariant }]}
                elevation={1}
            >
                <View style={styles.guestBadgeRow}>
                    <Icon source="account-outline" size={28} color={theme.colors.primary} />
                    <View style={styles.guestBadgeText}>
                        <Text
                            variant="titleMedium"
                            style={{ color: theme.colors.onSurface }}
                            testID="guest-mode-label"
                        >
                            Guest Mode
                        </Text>
                        <Text
                            variant="bodySmall"
                            style={{ color: theme.colors.onSurfaceVariant }}
                        >
                            Using local features only
                        </Text>
                    </View>
                </View>

                <Divider style={{ marginVertical: spacing.md }} />

                <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant, marginBottom: spacing.md }}
                >
                    Create an account to unlock cloud rendering, project sync, subscriptions,
                    and more.
                </Text>

                <Button
                    mode="contained"
                    onPress={handleSignIn}
                    icon="login"
                    style={styles.signInButton}
                    testID="guest-sign-in"
                >
                    Sign In
                </Button>
            </Surface>

            {/* Features list */}
            <Text
                variant="titleMedium"
                style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
            >
                Available in Guest Mode
            </Text>

            <Surface style={[styles.card, { borderColor: theme.colors.outlineVariant }]} elevation={1}>
                <List.Item
                    title="Local Projects"
                    description="Create, edit, and manage projects offline"
                    left={(props) => <List.Icon {...props} icon="folder-check-outline" />}
                />
                <Divider />
                <List.Item
                    title="Code Editor"
                    description="Full Monaco editor with syntax highlighting"
                    left={(props) => <List.Icon {...props} icon="code-braces" />}
                />
                <Divider />
                <List.Item
                    title="Preview System"
                    description="Real-time preview of your animations"
                    left={(props) => <List.Icon {...props} icon="play-circle-outline" />}
                />
            </Surface>

            <Text
                variant="titleMedium"
                style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
            >
                Requires Account
            </Text>

            <Surface style={[styles.card, { borderColor: theme.colors.outlineVariant }]} elevation={1}>
                <List.Item
                    title="Cloud Rendering"
                    description="Render videos in the cloud"
                    left={(props) => <List.Icon {...props} icon="cloud-outline" color={theme.colors.onSurfaceVariant} />}
                    titleStyle={{ color: theme.colors.onSurfaceVariant }}
                    descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                />
                <Divider />
                <List.Item
                    title="Project Sync"
                    description="Sync projects across devices"
                    left={(props) => <List.Icon {...props} icon="sync" color={theme.colors.onSurfaceVariant} />}
                    titleStyle={{ color: theme.colors.onSurfaceVariant }}
                    descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                />
                <Divider />
                <List.Item
                    title="Subscriptions & Credits"
                    description="Pro features and render credits"
                    left={(props) => <List.Icon {...props} icon="crown-outline" color={theme.colors.onSurfaceVariant} />}
                    titleStyle={{ color: theme.colors.onSurfaceVariant }}
                    descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                />
            </Surface>

            <View style={styles.bottomSpacer} />
        </ScrollView>
    );
}

// ---------------------------------------------------------------------------
// Authenticated settings view
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
    const theme = useAppTheme();
    const router = useRouter();

    const user = useAuthStore((s) => s.user);
    const isGuest = useAuthStore((s) => s.isGuest);
    const logout = useAuthStore((s) => s.logout);

    // --- Guest mode: render simplified view ---
    if (isGuest) {
        return <GuestSettingsView />;
    }

    return <AuthenticatedSettings />;
}

function AuthenticatedSettings() {
    const theme = useAppTheme();
    const router = useRouter();

    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);

    const {
        currentTier,
        creditBalance,
        usage,
        subscription,
        loadSubscription,
    } = useSubscriptionStore();

    useEffect(() => {
        void loadSubscription();
    }, [loadSubscription]);

    const limits = useMemo(
        () => TIER_LIMITS[currentTier],
        [currentTier],
    );

    const pricing = useMemo(
        () => SUBSCRIPTION_PRICING.find((p) => p.tier === currentTier),
        [currentTier],
    );

    // Storage progress (0-1)
    const storageProgress = useMemo(() => {
        if (!usage || isUnlimited(limits.storageBytes)) return 0;
        return Math.min(usage.storageUsedBytes / limits.storageBytes, 1);
    }, [usage, limits.storageBytes]);

    // Daily render progress (0-1)
    const renderProgress = useMemo(() => {
        if (!usage || isUnlimited(limits.maxRendersPerDay)) return 0;
        return Math.min(usage.rendersToday / limits.maxRendersPerDay, 1);
    }, [usage, limits.maxRendersPerDay]);

    const handleManageSubscription = useCallback(() => {
        // Opens the native subscription management page
        if (Platform.OS === 'ios') {
            void Linking.openURL('https://apps.apple.com/account/subscriptions');
        } else {
            void Linking.openURL('https://play.google.com/store/account/subscriptions');
        }
    }, []);

    const handleLogout = useCallback(async () => {
        await logout();
    }, [logout]);

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            contentContainerStyle={styles.content}
        >
            {/* ----------------------------------------------------------- */}
            {/* Subscription Section                                         */}
            {/* ----------------------------------------------------------- */}

            <Text
                variant="titleMedium"
                style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
            >
                Subscription
            </Text>

            <Surface style={[styles.card, { borderColor: theme.colors.outlineVariant }]} elevation={1}>
                <View style={styles.row}>
                    <View style={styles.tierBadge}>
                        <Icon source="crown-outline" size={20} color={theme.colors.primary} />
                        <Text
                            variant="titleMedium"
                            style={{ color: theme.colors.primary, marginLeft: spacing.xs }}
                        >
                            {limits.label}
                        </Text>
                    </View>
                    {pricing && pricing.monthlyPriceUsdCents > 0 && (
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {formatUsdCents(pricing.monthlyPriceUsdCents)}/mo
                        </Text>
                    )}
                </View>

                {subscription && (
                    <>
                        <Divider style={{ marginVertical: spacing.sm }} />
                        <View style={styles.row}>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                Status
                            </Text>
                            <Text
                                variant="bodySmall"
                                style={{
                                    color: subscription.status === 'active'
                                        ? theme.colors.primary
                                        : theme.colors.error,
                                    textTransform: 'capitalize',
                                }}
                            >
                                {subscription.status}
                            </Text>
                        </View>
                        <View style={styles.row}>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                Renews
                            </Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>
                                {subscription.cancelAtPeriodEnd
                                    ? `Cancels ${formatDate(subscription.currentPeriodEnd)}`
                                    : formatDate(subscription.currentPeriodEnd)}
                            </Text>
                        </View>
                    </>
                )}

                <View style={styles.buttonRow}>
                    {currentTier !== 'enterprise' && (
                        <Button
                            mode="contained"
                            compact
                            onPress={() => router.push('/paywall' as never)}
                            style={styles.cardButton}
                        >
                            {currentTier === 'free' ? 'Upgrade' : 'Change Plan'}
                        </Button>
                    )}
                    {subscription && (
                        <Button
                            mode="outlined"
                            compact
                            onPress={handleManageSubscription}
                            style={styles.cardButton}
                        >
                            Manage
                        </Button>
                    )}
                </View>
            </Surface>

            {/* ----------------------------------------------------------- */}
            {/* Usage Section                                                */}
            {/* ----------------------------------------------------------- */}

            <Text
                variant="titleMedium"
                style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
            >
                Usage
            </Text>

            <Surface style={[styles.card, { borderColor: theme.colors.outlineVariant }]} elevation={1}>
                {/* Credits */}
                <List.Item
                    title="Render Credits"
                    description={`${creditBalance} remaining`}
                    left={(props) => <List.Icon {...props} icon="currency-usd" />}
                    right={() => (
                        <Button
                            mode="text"
                            compact
                            onPress={() => router.push('/credits' as never)}
                        >
                            Buy More
                        </Button>
                    )}
                />

                <Divider />

                {/* Storage */}
                <View style={styles.usageItem}>
                    <View style={styles.row}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                            Storage
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {usage
                                ? `${formatBytes(usage.storageUsedBytes)} / ${isUnlimited(limits.storageBytes) ? '∞' : formatBytes(limits.storageBytes)}`
                                : '—'}
                        </Text>
                    </View>
                    {!isUnlimited(limits.storageBytes) && (
                        <ProgressBar
                            progress={storageProgress}
                            color={
                                storageProgress > 0.9
                                    ? theme.colors.error
                                    : theme.colors.primary
                            }
                            style={styles.progressBar}
                        />
                    )}
                </View>

                <Divider />

                {/* Daily renders */}
                <View style={styles.usageItem}>
                    <View style={styles.row}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                            Renders Today
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {usage
                                ? `${usage.rendersToday} / ${isUnlimited(limits.maxRendersPerDay) ? '∞' : limits.maxRendersPerDay}`
                                : '—'}
                        </Text>
                    </View>
                    {!isUnlimited(limits.maxRendersPerDay) && (
                        <ProgressBar
                            progress={renderProgress}
                            color={
                                renderProgress > 0.9
                                    ? theme.colors.error
                                    : theme.colors.primary
                            }
                            style={styles.progressBar}
                        />
                    )}
                </View>
            </Surface>

            {/* ----------------------------------------------------------- */}
            {/* Account Section                                              */}
            {/* ----------------------------------------------------------- */}

            <Text
                variant="titleMedium"
                style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
            >
                Account
            </Text>

            <Surface style={[styles.card, { borderColor: theme.colors.outlineVariant }]} elevation={1}>
                <List.Item
                    title={user?.displayName ?? 'User'}
                    description={user?.email ?? ''}
                    left={(props) => <List.Icon {...props} icon="account-circle-outline" />}
                />
                <Divider />
                <List.Item
                    title="Log Out"
                    titleStyle={{ color: theme.colors.error }}
                    left={(props) => <List.Icon {...props} icon="logout" color={theme.colors.error} />}
                    onPress={() => {
                        Alert.alert(
                            'Log Out',
                            'Are you sure you want to log out?',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Log Out', style: 'destructive', onPress: () => void handleLogout() },
                            ],
                        );
                    }}
                    testID="settings-logout"
                />
            </Surface>

            <View style={styles.bottomSpacer} />
        </ScrollView>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: spacing.md,
        paddingBottom: spacing['3xl'],
    },
    sectionTitle: {
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    card: {
        borderRadius: radii.lg,
        borderWidth: 1,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    tierBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    cardButton: {
        flex: 1,
    },
    usageItem: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    progressBar: {
        marginTop: spacing.xs,
        borderRadius: radii.sm,
        height: 6,
    },
    bottomSpacer: {
        height: spacing['3xl'],
    },
    // Guest mode styles
    guestCard: {
        borderRadius: radii.lg,
        borderWidth: 1,
        padding: spacing.md,
        marginTop: spacing.lg,
    },
    guestBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    guestBadgeText: {
        marginLeft: spacing.md,
    },
    signInButton: {
        borderRadius: radii.md,
    },
});
