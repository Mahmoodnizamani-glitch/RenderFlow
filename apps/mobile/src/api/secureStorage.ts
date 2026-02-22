/**
 * Secure token storage using expo-secure-store.
 *
 * Tokens are stored encrypted on-device — never in plain state,
 * AsyncStorage, or MMKV. Keys are prefixed to avoid collisions.
 */
import * as SecureStore from 'expo-secure-store';

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

const ACCESS_TOKEN_KEY = 'rf_access_token';
const REFRESH_TOKEN_KEY = 'rf_refresh_token';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export async function setTokens(
    accessToken: string,
    refreshToken: string,
): Promise<void> {
    await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
}

export async function getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
    await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
}
