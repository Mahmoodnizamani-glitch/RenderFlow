/**
 * RevenueCat SDK wrapper.
 *
 * Provides typed functions for initialising RevenueCat, fetching
 * offerings, purchasing packages, and restoring purchases.
 *
 * Uses react-native-purchases for IAP integration on iOS and Android.
 * Falls back gracefully in development when the SDK is unavailable.
 */
import Constants from 'expo-constants';

// ---------------------------------------------------------------------------
// Types (SDK-independent so tests can work without the native module)
// ---------------------------------------------------------------------------

export interface PurchasePackage {
    identifier: string;
    packageType: string;
    product: {
        identifier: string;
        title: string;
        description: string;
        priceString: string;
        price: number;
        currencyCode: string;
    };
}

export interface PurchaseOffering {
    identifier: string;
    packages: PurchasePackage[];
}

export interface CustomerInfo {
    activeSubscriptions: string[];
    entitlements: Record<string, {
        identifier: string;
        isActive: boolean;
        productIdentifier: string;
        willRenew: boolean;
        expirationDate: string | null;
    }>;
}

// ---------------------------------------------------------------------------
type PurchasesSDK = {
    configure: (config: { apiKey: string; appUserID: string | null }) => void;
    getOfferings: () => Promise<{ current: PurchaseOffering | null; all: Record<string, PurchaseOffering> }>;
    purchasePackage: (pkg: PurchasePackage) => Promise<{ customerInfo: CustomerInfo }>;
    restorePurchases: () => Promise<CustomerInfo>;
    getCustomerInfo: () => Promise<CustomerInfo>;
    logIn: (appUserID: string) => Promise<{ customerInfo: CustomerInfo; created: boolean }>;
    logOut: () => Promise<CustomerInfo>;
};

import Purchases from 'react-native-purchases';

let _purchases: PurchasesSDK | null = Purchases as unknown as PurchasesSDK;
let _initialised = false;

async function getSDK(): Promise<PurchasesSDK | null> {
    return _purchases;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const REVENUECAT_API_KEY =
    Constants.expoConfig?.extra?.['revenueCatApiKey'] ??
    '';

/**
 * Initialise the RevenueCat SDK with the API key.
 * Should be called once at app start after auth hydration.
 *
 * @param appUserID — The user's ID from your backend (for cross-platform sync).
 */
export async function initPurchases(appUserID: string | null): Promise<boolean> {
    if (_initialised) return true;

    const sdk = await getSDK();
    if (!sdk || !REVENUECAT_API_KEY) {
        console.warn('[Purchases] RevenueCat SDK not available or API key not configured');
        return false;
    }

    sdk.configure({ apiKey: REVENUECAT_API_KEY, appUserID });
    _initialised = true;
    return true;
}

/**
 * Log in a user to RevenueCat (call after backend login).
 * This syncs their purchase history across devices.
 */
export async function loginPurchases(appUserID: string): Promise<CustomerInfo | null> {
    const sdk = await getSDK();
    if (!sdk) return null;

    const { customerInfo } = await sdk.logIn(appUserID);
    return customerInfo;
}

/**
 * Log out the current RevenueCat user (call on app logout).
 */
export async function logoutPurchases(): Promise<void> {
    const sdk = await getSDK();
    if (!sdk) return;

    await sdk.logOut();
}

/**
 * Fetch available subscription offerings from RevenueCat.
 */
export async function getOfferings(): Promise<PurchaseOffering | null> {
    const sdk = await getSDK();
    if (!sdk) return null;

    const offerings = await sdk.getOfferings();
    return offerings.current ?? null;
}

/**
 * Purchase a subscription or credit pack package.
 * Returns the updated customer info on success.
 * Throws on cancellation or error.
 */
export async function purchasePackage(
    pkg: PurchasePackage,
): Promise<CustomerInfo> {
    const sdk = await getSDK();
    if (!sdk) {
        throw new Error('RevenueCat SDK not available');
    }

    const { customerInfo } = await sdk.purchasePackage(pkg);
    return customerInfo;
}

/**
 * Restore previous purchases (e.g. after reinstall).
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
    const sdk = await getSDK();
    if (!sdk) return null;

    return sdk.restorePurchases();
}

/**
 * Get the current customer info (active subscriptions, entitlements).
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
    const sdk = await getSDK();
    if (!sdk) return null;

    return sdk.getCustomerInfo();
}

/**
 * Check if the SDK has been initialised.
 */
export function isInitialised(): boolean {
    return _initialised;
}

/**
 * Reset initialisation state. **Test-only.**
 */
export function resetPurchases(): void {
    _initialised = false;
    _purchases = null;
}
