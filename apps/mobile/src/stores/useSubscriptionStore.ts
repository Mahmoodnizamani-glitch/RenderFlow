/**
 * Subscription Zustand store.
 *
 * Manages subscription state: current tier, credit balance, offerings,
 * purchase flow, and usage data. Integrates with RevenueCat for IAP
 * and the backend API for usage metrics.
 */
import { create } from 'zustand';
import type { UserTier } from '@renderflow/shared';
import { tierLevel } from '@renderflow/shared';

import * as purchasesApi from '../api/purchases';
import type { PurchaseOffering, PurchasePackage } from '../api/purchases';
import * as subscriptionApi from '../api/subscription';
import type { SubscriptionResponse, UsageResponse } from '../api/subscription';
import { extractApiError } from '../api/errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubscriptionState {
    /** Current user tier (derived from auth store or subscription data). */
    currentTier: UserTier;
    /** True if tier is 'pro' or higher. */
    isProOrAbove: boolean;
    /** Current subscription details from API. */
    subscription: SubscriptionResponse | null;
    /** Credit balance. */
    creditBalance: number;
    /** Usage summary from API. */
    usage: UsageResponse | null;
    /** Available RevenueCat offerings. */
    offerings: PurchaseOffering | null;
    /** Loading state for fetch operations. */
    isLoading: boolean;
    /** Loading state for purchase operations. */
    isPurchasing: boolean;
    /** Whether the store has been hydrated. */
    isHydrated: boolean;
    /** Error message from last operation. */
    error: string | null;
}

interface SubscriptionActions {
    /** Load subscription and usage from API + RevenueCat offerings. */
    loadSubscription: () => Promise<void>;
    /** Refresh just the credit balance. */
    refreshBalance: () => Promise<void>;
    /** Purchase a RevenueCat package. */
    purchase: (pkg: PurchasePackage) => Promise<boolean>;
    /** Restore previous purchases. */
    restore: () => Promise<boolean>;
    /** Set the tier (used by auth store on login). */
    setTier: (tier: UserTier) => void;
    /** Clear error state. */
    clearError: () => void;
    /** Reset store (on logout). */
    reset: () => void;
}

export type SubscriptionStore = SubscriptionState & SubscriptionActions;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: SubscriptionState = {
    currentTier: 'free',
    isProOrAbove: false,
    subscription: null,
    creditBalance: 0,
    usage: null,
    offerings: null,
    isLoading: false,
    isPurchasing: false,
    isHydrated: false,
    error: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSubscriptionStore = create<SubscriptionStore>()((set, get) => ({
    ...initialState,

    loadSubscription: async (): Promise<void> => {
        const { isLoading } = get();
        if (isLoading) return;

        set({ isLoading: true, error: null });

        try {
            // Fetch API data and RevenueCat offerings in parallel
            const [usageSummary, offerings] = await Promise.all([
                subscriptionApi.getUsageSummary(),
                purchasesApi.getOfferings(),
            ]);

            const tier = (usageSummary.usage.tier as UserTier) ?? 'free';

            set({
                currentTier: tier,
                isProOrAbove: tierLevel(tier) >= tierLevel('pro'),
                subscription: usageSummary.subscription,
                creditBalance: usageSummary.usage.creditBalance,
                usage: usageSummary.usage,
                offerings,
                isLoading: false,
                isHydrated: true,
            });
        } catch (err: unknown) {
            const apiError = extractApiError(err);
            set({
                isLoading: false,
                isHydrated: true,
                error: apiError.message,
            });
        }
    },

    refreshBalance: async (): Promise<void> => {
        try {
            const usageSummary = await subscriptionApi.getUsageSummary();
            set({
                creditBalance: usageSummary.usage.creditBalance,
                usage: usageSummary.usage,
            });
        } catch (err: unknown) {
            const apiError = extractApiError(err);
            set({ error: apiError.message });
        }
    },

    purchase: async (pkg: PurchasePackage): Promise<boolean> => {
        set({ isPurchasing: true, error: null });

        try {
            await purchasesApi.purchasePackage(pkg);

            // Refresh subscription state from API after purchase
            // RevenueCat webhook will update the backend
            // Use a small delay to allow webhook processing
            await new Promise((resolve) => setTimeout(resolve, 2000));
            await get().loadSubscription();

            set({ isPurchasing: false });
            return true;
        } catch (err: unknown) {
            // RevenueCat throws specific error for user cancellation
            const message = err instanceof Error ? err.message : 'Purchase failed';
            const isCancelled = message.includes('cancelled') || message.includes('canceled');

            set({
                isPurchasing: false,
                error: isCancelled ? null : message,
            });
            return false;
        }
    },

    restore: async (): Promise<boolean> => {
        set({ isLoading: true, error: null });

        try {
            const customerInfo = await purchasesApi.restorePurchases();

            if (customerInfo) {
                // Refresh from API to get synced state
                await get().loadSubscription();
            }

            set({ isLoading: false });
            return true;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Restore failed';
            set({
                isLoading: false,
                error: message,
            });
            return false;
        }
    },

    setTier: (tier: UserTier): void => {
        set({
            currentTier: tier,
            isProOrAbove: tierLevel(tier) >= tierLevel('pro'),
        });
    },

    clearError: (): void => {
        set({ error: null });
    },

    reset: (): void => {
        set(initialState);
    },
}));
