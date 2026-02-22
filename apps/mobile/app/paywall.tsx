/**
 * Paywall screen — subscription plan comparison and purchase flow.
 *
 * Presented as a modal route. Shows Free vs Pro vs Team vs Enterprise
 * with feature comparison, monthly/annual toggle, and RevenueCat purchase.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
    Button,
    IconButton,
    SegmentedButtons,
    Surface,
    Text,
    ActivityIndicator,
    Divider,
    Snackbar,
} from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useAppTheme } from '../src/theme';
import { spacing, radii } from '../src/theme/tokens';
import {
    TIER_LIMITS,
    SUBSCRIPTION_PRICING,
    formatUsdCents,
    isUnlimited,
} from '@renderflow/shared';
import type { UserTier } from '@renderflow/shared';
import { useSubscriptionStore } from '../src/stores/useSubscriptionStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BillingCycle = 'monthly' | 'annual';

interface PlanCardProps {
    tier: UserTier;
    billingCycle: BillingCycle;
    isCurrentPlan: boolean;
    onSelect: () => void;
    isPurchasing: boolean;
}

// ---------------------------------------------------------------------------
// Feature list for comparison
// ---------------------------------------------------------------------------

const FEATURE_ROWS: { label: string; key: keyof typeof TIER_LIMITS.free | 'custom' }[] = [
    { label: 'Projects', key: 'maxProjects' },
    { label: 'Daily renders', key: 'maxRendersPerDay' },
    { label: 'Max resolution', key: 'maxResolutionHeight' },
    { label: 'Storage', key: 'storageBytes' },
    { label: 'Monthly credits', key: 'monthlyCredits' },
    { label: 'Watermark-free', key: 'custom' },
    { label: 'Priority rendering', key: 'custom' },
];

function formatFeatureValue(tier: UserTier, row: typeof FEATURE_ROWS[0]): string {
    const limits = TIER_LIMITS[tier];

    switch (row.key) {
        case 'maxProjects':
            return isUnlimited(limits.maxProjects)
                ? 'Unlimited'
                : `${limits.maxProjects}`;
        case 'maxRendersPerDay':
            return isUnlimited(limits.maxRendersPerDay)
                ? 'Unlimited'
                : `${limits.maxRendersPerDay}/day`;
        case 'maxResolutionHeight':
            return `${limits.maxResolutionHeight}p`;
        case 'storageBytes':
            return isUnlimited(limits.storageBytes)
                ? 'Unlimited'
                : limits.storageBytes >= 1024 * 1024 * 1024
                    ? `${Math.round(limits.storageBytes / (1024 * 1024 * 1024))} GB`
                    : `${Math.round(limits.storageBytes / (1024 * 1024))} MB`;
        case 'monthlyCredits':
            return isUnlimited(limits.monthlyCredits)
                ? 'Unlimited'
                : limits.monthlyCredits === 0
                    ? '—'
                    : `${limits.monthlyCredits}`;
        case 'custom':
            if (row.label === 'Watermark-free') {
                return limits.hasWatermark ? '—' : '✓';
            }
            if (row.label === 'Priority rendering') {
                return (limits.features as readonly string[]).includes('priority_render')
                    ? '✓'
                    : '—';
            }
            return '—';
        default:
            return '—';
    }
}

// ---------------------------------------------------------------------------
// Plan card component
// ---------------------------------------------------------------------------

function PlanCard({ tier, billingCycle, isCurrentPlan, onSelect, isPurchasing }: PlanCardProps) {
    const theme = useAppTheme();
    const pricing = SUBSCRIPTION_PRICING.find((p) => p.tier === tier);
    const limits = TIER_LIMITS[tier];

    const priceText = useMemo(() => {
        if (!pricing || pricing.monthlyPriceUsdCents === 0) return 'Free';
        const cents = billingCycle === 'annual'
            ? Math.round(pricing.annualPriceUsdCents / 12)
            : pricing.monthlyPriceUsdCents;
        return `${formatUsdCents(cents)}/mo`;
    }, [pricing, billingCycle]);

    const savingsText = useMemo(() => {
        if (!pricing || billingCycle !== 'annual' || pricing.monthlyPriceUsdCents === 0) return null;
        const monthlyCost = pricing.monthlyPriceUsdCents * 12;
        const savings = monthlyCost - pricing.annualPriceUsdCents;
        return savings > 0 ? `Save ${formatUsdCents(savings)}/yr` : null;
    }, [pricing, billingCycle]);

    const isPopular = tier === 'pro';

    return (
        <Surface
            style={[
                styles.planCard,
                {
                    borderColor: isPopular
                        ? theme.colors.primary
                        : theme.colors.outlineVariant,
                    borderWidth: isPopular ? 2 : 1,
                },
            ]}
            elevation={isPopular ? 2 : 1}
        >
            {isPopular && (
                <View style={[styles.popularBadge, { backgroundColor: theme.colors.primary }]}>
                    <Text variant="labelSmall" style={{ color: theme.colors.onPrimary }}>
                        Most Popular
                    </Text>
                </View>
            )}

            <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
                {limits.label}
            </Text>

            <View style={styles.priceRow}>
                <Text variant="headlineMedium" style={{ color: theme.colors.primary }}>
                    {priceText}
                </Text>
                {savingsText && (
                    <Text
                        variant="labelSmall"
                        style={{ color: theme.colors.tertiary, marginLeft: spacing.sm }}
                    >
                        {savingsText}
                    </Text>
                )}
            </View>

            {pricing && pricing.trialDays > 0 && !isCurrentPlan && (
                <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.secondary, marginBottom: spacing.sm }}
                >
                    {pricing.trialDays}-day free trial
                </Text>
            )}

            <Divider style={{ marginVertical: spacing.sm }} />

            {FEATURE_ROWS.map((row) => (
                <View key={row.label} style={styles.featureRow}>
                    <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}
                    >
                        {row.label}
                    </Text>
                    <Text
                        variant="bodySmall"
                        style={{
                            color: formatFeatureValue(tier, row) === '—'
                                ? theme.colors.onSurfaceVariant
                                : theme.colors.onSurface,
                            fontWeight: formatFeatureValue(tier, row) === '✓' ? '700' : '400',
                        }}
                    >
                        {formatFeatureValue(tier, row)}
                    </Text>
                </View>
            ))}

            <Button
                mode={isCurrentPlan ? 'outlined' : 'contained'}
                disabled={isCurrentPlan || isPurchasing}
                onPress={onSelect}
                style={{ marginTop: spacing.md }}
                loading={isPurchasing}
            >
                {isCurrentPlan
                    ? 'Current Plan'
                    : tier === 'free'
                        ? 'Downgrade'
                        : 'Get Started'}
            </Button>
        </Surface>
    );
}

// ---------------------------------------------------------------------------
// Paywall screen
// ---------------------------------------------------------------------------

export default function PaywallScreen() {
    const theme = useAppTheme();
    const router = useRouter();

    const {
        currentTier,
        offerings,
        isPurchasing,
        isLoading,
        error,
        loadSubscription,
        purchase,
        restore,
        clearError,
    } = useSubscriptionStore();

    const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');

    // Load offerings on mount
    useEffect(() => {
        void loadSubscription();
    }, [loadSubscription]);

    const handlePlanSelect = useCallback(
        async (tier: UserTier) => {
            if (tier === 'free' || tier === currentTier) return;

            // Find the matching RevenueCat package
            const pricing = SUBSCRIPTION_PRICING.find((p) => p.tier === tier);
            if (!pricing) return;

            const productId = billingCycle === 'annual'
                ? pricing.annualProductId
                : pricing.monthlyProductId;

            const pkg = offerings?.packages.find(
                (p) => p.product.identifier === productId,
            );

            if (pkg) {
                const success = await purchase(pkg);
                if (success) {
                    router.back();
                }
            }
        },
        [currentTier, billingCycle, offerings, purchase, router],
    );

    const handleRestore = useCallback(async () => {
        await restore();
    }, [restore]);

    const tiers: UserTier[] = ['free', 'pro', 'team', 'enterprise'];

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <IconButton
                    icon="close"
                    onPress={() => router.back()}
                    testID="paywall-close"
                />
                <Text variant="titleLarge" style={{ color: theme.colors.onSurface, flex: 1 }}>
                    Choose Your Plan
                </Text>
                <Button
                    mode="text"
                    compact
                    onPress={handleRestore}
                    disabled={isLoading}
                >
                    Restore
                </Button>
            </View>

            {/* Billing toggle */}
            <View style={styles.toggleContainer}>
                <SegmentedButtons
                    value={billingCycle}
                    onValueChange={(v) => setBillingCycle(v as BillingCycle)}
                    buttons={[
                        { value: 'monthly', label: 'Monthly' },
                        { value: 'annual', label: 'Annual (Save 17%)' },
                    ]}
                />
            </View>

            {/* Plans */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.plansContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {tiers.map((tier) => (
                        <PlanCard
                            key={tier}
                            tier={tier}
                            billingCycle={billingCycle}
                            isCurrentPlan={tier === currentTier}
                            onSelect={() => void handlePlanSelect(tier)}
                            isPurchasing={isPurchasing}
                        />
                    ))}

                    <Text
                        variant="bodySmall"
                        style={[styles.disclaimer, { color: theme.colors.onSurfaceVariant }]}
                    >
                        Subscriptions auto-renew. Cancel anytime in your device settings.
                        Payment is charged to your App Store or Google Play account.
                    </Text>
                </ScrollView>
            )}

            {/* Error snackbar */}
            <Snackbar
                visible={!!error}
                onDismiss={clearError}
                duration={4000}
                action={{ label: 'Dismiss', onPress: clearError }}
            >
                {error ?? ''}
            </Snackbar>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
    },
    toggleContainer: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    plansContainer: {
        padding: spacing.md,
        gap: spacing.md,
        paddingBottom: spacing['3xl'],
    },
    planCard: {
        padding: spacing.lg,
        borderRadius: radii.lg,
        overflow: 'hidden',
    },
    popularBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderBottomLeftRadius: radii.md,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: spacing.xs,
    },
    featureRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.xs,
    },
    disclaimer: {
        textAlign: 'center',
        marginTop: spacing.lg,
        paddingHorizontal: spacing.lg,
    },
});
