/**
 * Auth Zustand store.
 *
 * Manages authentication state: user profile, loading, errors.
 * Integrates with secure token storage and the auth API.
 *
 * On app start, `hydrate()` checks for existing tokens and validates
 * them via getMe(). If valid, the user is restored. If not, tokens
 * are cleared and the user is routed to login.
 *
 * Guest mode: users can bypass auth to use local-only features.
 * The guest flag is persisted in MMKV so it survives restarts.
 */
import { create } from 'zustand';
import { ID } from 'react-native-appwrite';
import type { UserResponse } from '@renderflow/shared';

import { appwriteAccount } from '../lib/appwrite';
import { onTokenCleared, setGuestMode } from '../api/client';

// Appwrite handles its own token storage, so we don't need secureStorage anymore.

// ---------------------------------------------------------------------------
// MMKV storage for guest flag persistence
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MMKV: MMKVClass } = require('react-native-mmkv') as {
    MMKV: new (config?: { id?: string }) => {
        getString(key: string): string | undefined;
        set(key: string, value: string): void;
        delete(key: string): void;
        getBoolean(key: string): boolean | undefined;
    };
};

const guestStorage = new MMKVClass({ id: 'renderflow-auth' });
const GUEST_FLAG_KEY = 'rf_is_guest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthState {
    user: UserResponse | null;
    isAuthenticated: boolean;
    isGuest: boolean;
    isLoading: boolean;
    isHydrated: boolean;
    error: string | null;
}

interface AuthActions {
    login: (email: string, password: string) => Promise<boolean>;
    register: (email: string, password: string, displayName: string) => Promise<boolean>;
    logout: () => Promise<void>;
    hydrate: () => Promise<void>;
    continueAsGuest: () => void;
    clearError: () => void;
    setUser: (user: UserResponse) => void;
}

export type AuthStore = AuthState & AuthActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthStore>()((set, get) => {
    // Wire up the token-cleared callback so that if the API client
    // fails to refresh, the auth store resets automatically.
    onTokenCleared(() => {
        set({
            user: null,
            isAuthenticated: false,
            isGuest: false,
            error: null,
        });
        setGuestMode(false);
    });

    return {
        // State
        user: null,
        isAuthenticated: false,
        isGuest: false,
        isLoading: false,
        isHydrated: false,
        error: null,

        // Actions

        login: async (email: string, password: string): Promise<boolean> => {
            set({ isLoading: true, error: null });
            try {
                // Creates a persistent session stored via react-native-appwrite
                await appwriteAccount.createEmailPasswordSession(email, password);

                // Fetch user details
                const appwriteUser = await appwriteAccount.get();
                const user: UserResponse = {
                    id: appwriteUser.$id,
                    email: appwriteUser.email,
                    displayName: appwriteUser.name || 'User',
                    avatarUrl: null,
                    tier: 'free',
                    renderCredits: 0,
                    createdAt: appwriteUser.$createdAt,
                    updatedAt: appwriteUser.$updatedAt,
                    lastLoginAt: appwriteUser.$updatedAt,
                };

                // Clear guest flag if previously set
                guestStorage.delete(GUEST_FLAG_KEY);
                setGuestMode(false);

                set({
                    user,
                    isAuthenticated: true,
                    isGuest: false,
                    isLoading: false,
                });
                return true;
            } catch (err: unknown) {
                // Surface the raw error for debugging purposes instead of a generic message
                let message = 'Login failed';
                if (err instanceof Error) {
                    message = err.message;
                } else if (typeof err === 'object' && err !== null && 'message' in err) {
                    message = String((err as { message: unknown }).message);
                } else if (typeof err === 'string') {
                    message = err;
                } else {
                    message = JSON.stringify(err);
                }

                set({ isLoading: false, error: `Login Error: ${message}` });
                return false;
            }
        },

        register: async (
            email: string,
            password: string,
            displayName: string,
        ): Promise<boolean> => {
            set({ isLoading: true, error: null });
            try {
                // 1. Create the account
                console.log('[Register] Step 1: Creating account...');
                try {
                    await appwriteAccount.create(ID.unique(), email, password, displayName);
                    console.log('[Register] Step 1: Account created successfully');
                } catch (createErr: unknown) {
                    const msg = typeof createErr === 'object' && createErr !== null && 'message' in createErr
                        ? String((createErr as { message: unknown }).message)
                        : String(createErr);
                    console.error('[Register] Step 1 FAILED:', msg);
                    throw createErr;
                }

                // 2. Log them in to create a session
                console.log('[Register] Step 2: Creating session...');
                try {
                    await appwriteAccount.createEmailPasswordSession(email, password);
                    console.log('[Register] Step 2: Session created successfully');
                } catch (sessionErr: unknown) {
                    const msg = typeof sessionErr === 'object' && sessionErr !== null && 'message' in sessionErr
                        ? String((sessionErr as { message: unknown }).message)
                        : String(sessionErr);
                    console.error('[Register] Step 2 FAILED:', msg);
                    throw sessionErr;
                }

                console.log('[Register] Step 3: Getting user...');
                const appwriteUser = await appwriteAccount.get();
                console.log('[Register] Step 3: Got user:', appwriteUser.$id);

                const user: UserResponse = {
                    id: appwriteUser.$id,
                    email: appwriteUser.email,
                    displayName: appwriteUser.name || 'User',
                    avatarUrl: null,
                    tier: 'free',
                    renderCredits: 0,
                    createdAt: appwriteUser.$createdAt,
                    updatedAt: appwriteUser.$updatedAt,
                    lastLoginAt: appwriteUser.$updatedAt,
                };

                // Clear guest flag if previously set
                guestStorage.delete(GUEST_FLAG_KEY);
                setGuestMode(false);

                set({
                    user,
                    isAuthenticated: true,
                    isGuest: false,
                    isLoading: false,
                });
                return true;
            } catch (err: unknown) {
                // Avoid instanceof to prevent masking the real error
                let message = 'Registration failed';
                if (typeof err === 'object' && err !== null && 'message' in err) {
                    message = String((err as { message: unknown }).message);
                } else if (typeof err === 'string') {
                    message = err;
                } else {
                    try {
                        message = JSON.stringify(err);
                    } catch {
                        message = String(err);
                    }
                }

                console.error('[Register] Final error:', message);
                set({ isLoading: false, error: `Registration Error: ${message}` });
                return false;
            }
        },

        logout: async (): Promise<void> => {
            const { isGuest } = get();

            set({ isLoading: true });

            try {
                // Skip API call for guest users
                if (!isGuest) {
                    await appwriteAccount.deleteSession('current').catch(() => {
                        // Best-effort: if logout API fails, still clear local state
                    });
                }
            } finally {
                guestStorage.delete(GUEST_FLAG_KEY);
                setGuestMode(false);

                set({
                    user: null,
                    isAuthenticated: false,
                    isGuest: false,
                    isLoading: false,
                    error: null,
                });
            }
        },

        hydrate: async (): Promise<void> => {
            const { isHydrated } = get();
            if (isHydrated) return;

            set({ isLoading: true });

            // Check for persisted guest flag first (no network needed)
            const savedGuest = guestStorage.getBoolean(GUEST_FLAG_KEY);
            if (savedGuest) {
                setGuestMode(true);
                set({
                    user: null,
                    isAuthenticated: true,
                    isGuest: true,
                    isHydrated: true,
                    isLoading: false,
                });
                return;
            }

            try {
                // Appwrite natively stores the session, we just check if we can get the user
                const appwriteUser = await appwriteAccount.get();

                const user: UserResponse = {
                    id: appwriteUser.$id,
                    email: appwriteUser.email,
                    displayName: appwriteUser.name || 'User',
                    avatarUrl: null,
                    tier: 'free',
                    renderCredits: 0,
                    createdAt: appwriteUser.$createdAt,
                    updatedAt: appwriteUser.$updatedAt,
                    lastLoginAt: appwriteUser.$updatedAt,
                };

                set({
                    user,
                    isAuthenticated: true,
                    isGuest: false,
                    isHydrated: true,
                    isLoading: false,
                });
            } catch {
                // Token invalid or expired — clear and start fresh
                set({
                    user: null,
                    isAuthenticated: false,
                    isGuest: false,
                    isHydrated: true,
                    isLoading: false,
                });
            }
        },

        continueAsGuest: (): void => {
            guestStorage.set(GUEST_FLAG_KEY, 'true');
            setGuestMode(true);

            set({
                user: null,
                isAuthenticated: true,
                isGuest: true,
                isHydrated: true,
                isLoading: false,
                error: null,
            });
        },

        clearError: () => {
            set({ error: null });
        },

        setUser: (user: UserResponse) => {
            set({ user });
        },
    };
});
