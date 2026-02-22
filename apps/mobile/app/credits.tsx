/**
 * Credits purchase screen.
 *
 * Shows available credit packs with per-credit pricing, current balance,
 * and purchase via RevenueCat.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
    Button,
    IconButton,
    Surface,
    Text,
    Badge,
    ActivityIndicator,
    Snackbar,
} from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useAppTheme } from '../src/theme';
import { spacing, radii } from '../src/theme/tokens';
import { CREDIT_PACKS, formatUsdCents } from '@renderflow/shared';
import { useSubscriptionStore } from '../src/stores/useSubscriptionStore';

// ---------------------------------------------------------------------------
// Credit pack card
// ---------------------------------------------------------------------------

interface CreditPackCardProps {
    packId: string;
    credits: number;
    priceUsdCents: number;
    perCreditCents: number;
    label: string;
    isBestValue: boolean;
    isSelected: boolean;
    onSelect: () => void;
}

function CreditPackCard({
    credits: _credits,
    priceUsdCents,
    perCreditCents,
    label,
    isBestValue,
    isSelected,
    onSelect,
}: CreditPackCardProps) {
    const theme = useAppTheme();

    return (
        <Surface
            style={[
                styles.packCard,
                {
                    borderColor: isSelected
                        ? theme.colors.primary
                        : isBestValue
                            ? theme.colors.tertiary
                            : theme.colors.outlineVariant,
                    borderWidth: isSelected || isBestValue ? 2 : 1,
                },
            ]}
            elevation={isSelected ? 2 : 1}
            onTouchEnd={onSelect}
        >
            {isBestValue && (
                <Badge
                    style={[
                        styles.bestValueBadge,
                        { backgroundColor: theme.colors.tertiary },
                    ]}
                    size={22}
                >
                    Best Value
                </Badge>
            )}

            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                {label}
            </Text>

            <Text variant="headlineSmall" style={{ color: theme.colors.primary, marginTop: spacing.xs }}>
                {formatUsdCents(priceUsdCents)}
            </Text>

            <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: spacing.xs }}
            >
                {formatUsdCents(perCreditCents)} per credit
            </Text>
        </Surface>
    );
}

// ---------------------------------------------------------------------------
// Credits screen
// ---------------------------------------------------------------------------

export default function CreditsScreen() {
    const theme = useAppTheme();
    const router = useRouter();

    const {
        creditBalance,
        offerings,
        isPurchasing,
        isLoading,
        error,
        loadSubscription,
        purchase,
        clearError,
    } = useSubscriptionStore();

    const [selectedPackId, setSelectedPackId] = useState<string>(
        CREDIT_PACKS.find((p) => p.isBestValue)?.id ?? CREDIT_PACKS[0]?.id ?? '',
    );

    useEffect(() => {
        void loadSubscription();
    }, [loadSubscription]);

    const handlePurchase = useCallback(async () => {
        const pack = CREDIT_PACKS.find((p) => p.id === selectedPackId);
        if (!pack) return;

        // Find matching RevenueCat package
        const pkg = offerings?.packages.find(
            (p) => p.product.identifier === selectedPackId || p.identifier === selectedPackId,
        );

        if (pkg) {
            const success = await purchase(pkg);
            if (success) {
                router.back();
            }
        }
    }, [selectedPackId, offerings, purchase, router]);

    const selectedPack = CREDIT_PACKS.find((p) => p.id === selectedPackId);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <IconButton
                    icon="close"
                    onPress={() => router.back()}
                    testID="credits-close"
                />
                <Text variant="titleLarge" style={{ color: theme.colors.onSurface, flex: 1 }}>
                    Buy Credits
                </Text>
            </View>

            {/* Current balance */}
            <Surface style={[styles.balanceCard, { borderColor: theme.colors.outlineVariant }]} elevation={1}>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Current Balance
                </Text>
                <Text variant="headlineLarge" style={{ color: theme.colors.primary }}>
                    {creditBalance}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    credits
                </Text>
            </Surface>

            {/* Packs */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.packsContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {CREDIT_PACKS.map((pack) => (
                        <CreditPackCard
                            key={pack.id}
                            packId={pack.id}
                            credits={pack.credits}
                            priceUsdCents={pack.priceUsdCents}
                            perCreditCents={pack.perCreditCents}
                            label={pack.label}
                            isBestValue={pack.isBestValue}
                            isSelected={selectedPackId === pack.id}
                            onSelect={() => setSelectedPackId(pack.id)}
                        />
                    ))}
                </ScrollView>
            )}

            {/* Purchase button */}
            <View style={styles.footer}>
                <Button
                    mode="contained"
                    onPress={() => void handlePurchase()}
                    disabled={isPurchasing || !selectedPack}
                    loading={isPurchasing}
                    style={styles.purchaseButton}
                    contentStyle={styles.purchaseButtonContent}
                >
                    {selectedPack
                        ? `Buy ${selectedPack.label} — ${formatUsdCents(selectedPack.priceUsdCents)}`
                        : 'Select a pack'}
                </Button>
            </View>

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
    balanceCard: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    packsContainer: {
        padding: spacing.md,
        gap: spacing.sm,
    },
    packCard: {
        padding: spacing.lg,
        borderRadius: radii.md,
        overflow: 'hidden',
    },
    bestValueBadge: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
    },
    footer: {
        padding: spacing.md,
        paddingBottom: spacing['3xl'],
    },
    purchaseButton: {
        borderRadius: radii.md,
    },
    purchaseButtonContent: {
        paddingVertical: spacing.sm,
    },
});
