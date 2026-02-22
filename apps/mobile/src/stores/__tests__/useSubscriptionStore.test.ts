/**
 * Tests for the subscription Zustand store.
 */
import { useSubscriptionStore } from '../useSubscriptionStore';
import * as purchasesApi from '../../api/purchases';
import * as subscriptionApi from '../../api/subscription';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../api/purchases');
jest.mock('../../api/subscription');
jest.mock('../../api/errors', () => ({
    extractApiError: (err: unknown) => ({
        message: err instanceof Error ? err.message : 'Unknown error',
        code: 'UNKNOWN',
    }),
}));

const mockPurchasesApi = purchasesApi as jest.Mocked<typeof purchasesApi>;
const mockSubscriptionApi = subscriptionApi as jest.Mocked<typeof subscriptionApi>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUsageSummary: subscriptionApi.UsageSummaryResponse = {
    usage: {
        creditBalance: 50,
        storageUsedBytes: 1024 * 1024 * 100,
        storageLimitBytes: 1024 * 1024 * 1024,
        rendersToday: 3,
        maxRendersPerDay: 10,
        tier: 'pro',
    },
    subscription: {
        id: 'sub-1',
        userId: 'user-1',
        tier: 'pro',
        status: 'active',
        provider: 'revenuecat',
        currentPeriodStart: '2026-01-01T00:00:00Z',
        currentPeriodEnd: '2026-02-01T00:00:00Z',
        cancelAtPeriodEnd: false,
        trialEnd: null,
        createdAt: '2026-01-01T00:00:00Z',
    },
};

const mockOffering: purchasesApi.PurchaseOffering = {
    identifier: 'default',
    packages: [
        {
            identifier: 'pro-monthly',
            packageType: 'MONTHLY',
            product: {
                identifier: 'rf_pro_monthly',
                title: 'Pro Monthly',
                description: 'Pro plan',
                priceString: '$9.99',
                price: 9.99,
                currencyCode: 'USD',
            },
        },
    ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore(): void {
    useSubscriptionStore.setState({
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
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSubscriptionStore', () => {
    beforeEach(() => {
        resetStore();
        jest.clearAllMocks();
    });

    // -------------------------------------------------------------------
    // loadSubscription
    // -------------------------------------------------------------------

    describe('loadSubscription', () => {
        it('loads usage and offerings successfully', async () => {
            mockSubscriptionApi.getUsageSummary.mockResolvedValue(mockUsageSummary);
            mockPurchasesApi.getOfferings.mockResolvedValue(mockOffering);

            await useSubscriptionStore.getState().loadSubscription();

            const state = useSubscriptionStore.getState();
            expect(state.currentTier).toBe('pro');
            expect(state.isProOrAbove).toBe(true);
            expect(state.creditBalance).toBe(50);
            expect(state.subscription).toBeDefined();
            expect(state.offerings).toBe(mockOffering);
            expect(state.isHydrated).toBe(true);
            expect(state.isLoading).toBe(false);
        });

        it('sets error on API failure', async () => {
            mockSubscriptionApi.getUsageSummary.mockRejectedValue(
                new Error('Network error'),
            );
            mockPurchasesApi.getOfferings.mockResolvedValue(null);

            await useSubscriptionStore.getState().loadSubscription();

            const state = useSubscriptionStore.getState();
            expect(state.error).toBe('Network error');
            expect(state.isLoading).toBe(false);
            expect(state.isHydrated).toBe(true);
        });

        it('prevents concurrent loads', async () => {
            useSubscriptionStore.setState({ isLoading: true });

            mockSubscriptionApi.getUsageSummary.mockResolvedValue(mockUsageSummary);
            mockPurchasesApi.getOfferings.mockResolvedValue(null);

            await useSubscriptionStore.getState().loadSubscription();

            // Should not call API because already loading
            expect(mockSubscriptionApi.getUsageSummary).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------
    // refreshBalance
    // -------------------------------------------------------------------

    describe('refreshBalance', () => {
        it('updates credit balance', async () => {
            mockSubscriptionApi.getUsageSummary.mockResolvedValue({
                ...mockUsageSummary,
                usage: { ...mockUsageSummary.usage, creditBalance: 75 },
            });

            await useSubscriptionStore.getState().refreshBalance();

            expect(useSubscriptionStore.getState().creditBalance).toBe(75);
        });

        it('sets error on failure', async () => {
            mockSubscriptionApi.getUsageSummary.mockRejectedValue(
                new Error('Failed'),
            );

            await useSubscriptionStore.getState().refreshBalance();

            expect(useSubscriptionStore.getState().error).toBe('Failed');
        });
    });

    // -------------------------------------------------------------------
    // purchase
    // -------------------------------------------------------------------

    describe('purchase', () => {
        it('calls purchasePackage and reloads subscription', async () => {
            const mockCustomerInfo: purchasesApi.CustomerInfo = {
                activeSubscriptions: ['rf_pro_monthly'],
                entitlements: {},
            };
            mockPurchasesApi.purchasePackage.mockResolvedValue(mockCustomerInfo);
            mockSubscriptionApi.getUsageSummary.mockResolvedValue(mockUsageSummary);
            mockPurchasesApi.getOfferings.mockResolvedValue(mockOffering);

            const pkg = mockOffering.packages[0]!;
            const result = await useSubscriptionStore.getState().purchase(pkg);

            expect(result).toBe(true);
            expect(mockPurchasesApi.purchasePackage).toHaveBeenCalledWith(pkg);
            expect(useSubscriptionStore.getState().isPurchasing).toBe(false);
        });

        it('sets error on purchase failure', async () => {
            mockPurchasesApi.purchasePackage.mockRejectedValue(
                new Error('Payment method declined'),
            );

            const pkg = mockOffering.packages[0]!;
            const result = await useSubscriptionStore.getState().purchase(pkg);

            expect(result).toBe(false);
            expect(useSubscriptionStore.getState().error).toBe('Payment method declined');
            expect(useSubscriptionStore.getState().isPurchasing).toBe(false);
        });

        it('does not set error on user cancellation', async () => {
            mockPurchasesApi.purchasePackage.mockRejectedValue(
                new Error('User cancelled'),
            );

            const pkg = mockOffering.packages[0]!;
            const result = await useSubscriptionStore.getState().purchase(pkg);

            expect(result).toBe(false);
            expect(useSubscriptionStore.getState().error).toBeNull();
        });
    });

    // -------------------------------------------------------------------
    // restore
    // -------------------------------------------------------------------

    describe('restore', () => {
        it('restores purchases and reloads subscription', async () => {
            const mockCustomerInfo: purchasesApi.CustomerInfo = {
                activeSubscriptions: ['rf_pro_monthly'],
                entitlements: {},
            };
            mockPurchasesApi.restorePurchases.mockResolvedValue(mockCustomerInfo);
            mockSubscriptionApi.getUsageSummary.mockResolvedValue(mockUsageSummary);
            mockPurchasesApi.getOfferings.mockResolvedValue(mockOffering);

            const result = await useSubscriptionStore.getState().restore();

            expect(result).toBe(true);
            expect(mockPurchasesApi.restorePurchases).toHaveBeenCalled();
        });

        it('sets error on restore failure', async () => {
            mockPurchasesApi.restorePurchases.mockRejectedValue(
                new Error('Restore failed'),
            );

            const result = await useSubscriptionStore.getState().restore();

            expect(result).toBe(false);
            expect(useSubscriptionStore.getState().error).toBe('Restore failed');
        });
    });

    // -------------------------------------------------------------------
    // setTier / clearError / reset
    // -------------------------------------------------------------------

    describe('setTier', () => {
        it('updates tier and isProOrAbove', () => {
            useSubscriptionStore.getState().setTier('team');

            expect(useSubscriptionStore.getState().currentTier).toBe('team');
            expect(useSubscriptionStore.getState().isProOrAbove).toBe(true);
        });

        it('sets isProOrAbove to false for free', () => {
            useSubscriptionStore.getState().setTier('free');

            expect(useSubscriptionStore.getState().isProOrAbove).toBe(false);
        });
    });

    describe('clearError', () => {
        it('resets error to null', () => {
            useSubscriptionStore.setState({ error: 'Some error' });
            useSubscriptionStore.getState().clearError();
            expect(useSubscriptionStore.getState().error).toBeNull();
        });
    });

    describe('reset', () => {
        it('restores initial state', () => {
            useSubscriptionStore.setState({
                currentTier: 'pro',
                isProOrAbove: true,
                creditBalance: 100,
                isHydrated: true,
            });

            useSubscriptionStore.getState().reset();

            expect(useSubscriptionStore.getState().currentTier).toBe('free');
            expect(useSubscriptionStore.getState().isProOrAbove).toBe(false);
            expect(useSubscriptionStore.getState().creditBalance).toBe(0);
            expect(useSubscriptionStore.getState().isHydrated).toBe(false);
        });
    });
});
