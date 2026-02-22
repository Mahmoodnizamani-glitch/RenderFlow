/**
 * Axios API client with token interceptors.
 *
 * - Request interceptor: attaches access token from secure storage
 * - Response interceptor: on 401, refreshes token with mutex, retries
 * - If refresh fails: clears tokens, redirects to login
 * - Guest mode: rejects all requests immediately (no network calls)
 *
 * The refresh mutex ensures concurrent 401s don't trigger multiple
 * refresh requests — subsequent 401s queue behind the first refresh.
 */
import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import Constants from 'expo-constants';

import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './secureStorage';
import { ApiError } from './errors';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE_URL =
    Constants.expoConfig?.extra?.['apiUrl'] ??
    'https://renderflow-api.fly.dev';

// ---------------------------------------------------------------------------
// Guest mode flag
// ---------------------------------------------------------------------------

let _isGuestMode = false;

/**
 * Set guest mode on/off. When enabled, all API requests are rejected
 * immediately without making network calls.
 */
export function setGuestMode(enabled: boolean): void {
    _isGuestMode = enabled;
}

/**
 * Check whether the app is currently in guest mode.
 */
export function isGuestMode(): boolean {
    return _isGuestMode;
}

// ---------------------------------------------------------------------------
// Client instance
// ---------------------------------------------------------------------------

const apiClient: AxiosInstance = axios.create({
    baseURL: `${API_BASE_URL}/api/v1`,
    timeout: 30_000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ---------------------------------------------------------------------------
// Request interceptor — attach access token (or block guest mode)
// ---------------------------------------------------------------------------

apiClient.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
        if (_isGuestMode) {
            throw new ApiError(
                401,
                'Guest mode — sign in to access cloud features',
            );
        }

        const token = await getAccessToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error: AxiosError) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor — handle 401 with token refresh
// ---------------------------------------------------------------------------

let isRefreshing = false;
let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null): void {
    for (const { resolve, reject } of failedQueue) {
        if (error) {
            reject(error);
        } else if (token) {
            resolve(token);
        }
    }
    failedQueue = [];
}

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
            _retry?: boolean;
        };

        // Only handle 401s that haven't been retried
        if (error.response?.status !== 401 || originalRequest._retry) {
            return Promise.reject(error);
        }

        // Don't try to refresh the refresh endpoint itself
        if (originalRequest.url?.includes('/auth/refresh')) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        // If already refreshing, queue this request
        if (isRefreshing) {
            return new Promise<string>((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return apiClient(originalRequest);
            });
        }

        isRefreshing = true;

        try {
            const refreshTokenValue = await getRefreshToken();
            if (!refreshTokenValue) {
                throw new ApiError(401, 'No refresh token available');
            }

            // Call refresh endpoint directly (bypass interceptors)
            const response = await axios.post<{
                accessToken: string;
                refreshToken: string;
            }>(`${API_BASE_URL}/api/v1/auth/refresh`, {
                refreshToken: refreshTokenValue,
            });

            const { accessToken, refreshToken: newRefreshToken } = response.data;
            await setTokens(accessToken, newRefreshToken);

            processQueue(null, accessToken);

            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return apiClient(originalRequest);
        } catch (refreshError: unknown) {
            processQueue(refreshError, null);
            await clearTokens();

            // Signal auth store to reset — done via event-like pattern
            // The auth store subscribes to this via onTokenCleared callback
            _onTokenCleared?.();

            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    },
);

// ---------------------------------------------------------------------------
// Token-cleared callback (set by auth store)
// ---------------------------------------------------------------------------

type TokenClearedCallback = () => void;
let _onTokenCleared: TokenClearedCallback | null = null;

/**
 * Register a callback invoked when tokens are cleared due to
 * a failed refresh. Used by the auth store to reset state.
 */
export function onTokenCleared(callback: TokenClearedCallback): void {
    _onTokenCleared = callback;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export { apiClient };
export { API_BASE_URL };
