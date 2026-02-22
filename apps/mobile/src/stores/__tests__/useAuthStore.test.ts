/**
 * Tests for the auth Zustand store.
 */
import { useAuthStore } from '../useAuthStore';
import * as authApi from '../../api/auth';
import * as secureStorage from '../../api/secureStorage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../api/auth');
jest.mock('../../api/secureStorage');
jest.mock('../../api/client', () => ({
    apiClient: { post: jest.fn(), get: jest.fn() },
    API_BASE_URL: 'http://localhost:3001',
    onTokenCleared: jest.fn(),
    setGuestMode: jest.fn(),
    isGuestMode: jest.fn(() => false),
}));

// Mock MMKV for guest flag persistence
const mockMmkvStore: Record<string, string | boolean> = {};
jest.mock('react-native-mmkv', () => ({
    MMKV: jest.fn().mockImplementation(() => ({
        getString: jest.fn((key: string) => mockMmkvStore[key] as string | undefined),
        set: jest.fn((key: string, value: string | boolean) => {
            mockMmkvStore[key] = value;
        }),
        delete: jest.fn((key: string) => {
            delete mockMmkvStore[key];
        }),
        getBoolean: jest.fn((key: string) => {
            const val = mockMmkvStore[key];
            if (val === 'true' || val === true) return true;
            return undefined;
        }),
    })),
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockSecureStorage = secureStorage as jest.Mocked<typeof secureStorage>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: null,
    tier: 'free' as const,
    renderCredits: 100,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    lastLoginAt: null,
};

const mockAuthResponse = {
    user: mockUser,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function resetStore(): void {
    useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isGuest: false,
        isLoading: false,
        isHydrated: false,
        error: null,
    });
}

function clearMmkv(): void {
    for (const key of Object.keys(mockMmkvStore)) {
        delete mockMmkvStore[key];
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAuthStore', () => {
    beforeEach(() => {
        resetStore();
        clearMmkv();
        jest.clearAllMocks();
    });

    // -------------------------------------------------------------------
    // Login
    // -------------------------------------------------------------------

    describe('login', () => {
        it('sets user and isAuthenticated on success', async () => {
            mockAuthApi.login.mockResolvedValue(mockAuthResponse);
            mockSecureStorage.setTokens.mockResolvedValue();

            const success = await useAuthStore.getState().login('test@example.com', 'password123');

            expect(success).toBe(true);
            expect(useAuthStore.getState().user).toEqual(mockUser);
            expect(useAuthStore.getState().isAuthenticated).toBe(true);
            expect(useAuthStore.getState().isGuest).toBe(false);
            expect(useAuthStore.getState().isLoading).toBe(false);
            expect(useAuthStore.getState().error).toBeNull();
        });

        it('stores tokens in secure storage on success', async () => {
            mockAuthApi.login.mockResolvedValue(mockAuthResponse);
            mockSecureStorage.setTokens.mockResolvedValue();

            await useAuthStore.getState().login('test@example.com', 'password');

            expect(mockSecureStorage.setTokens).toHaveBeenCalledWith('access-token', 'refresh-token');
        });

        it('sets error on failure', async () => {
            mockAuthApi.login.mockRejectedValue(
                new Error('Invalid credentials'),
            );

            const success = await useAuthStore.getState().login('bad@email.com', 'wrong');

            expect(success).toBe(false);
            expect(useAuthStore.getState().user).toBeNull();
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(useAuthStore.getState().error).toBeTruthy();
            expect(useAuthStore.getState().isLoading).toBe(false);
        });
    });

    // -------------------------------------------------------------------
    // Register
    // -------------------------------------------------------------------

    describe('register', () => {
        it('sets user and isAuthenticated on success', async () => {
            mockAuthApi.register.mockResolvedValue(mockAuthResponse);
            mockSecureStorage.setTokens.mockResolvedValue();

            const success = await useAuthStore.getState().register(
                'test@example.com',
                'password123',
                'Test User',
            );

            expect(success).toBe(true);
            expect(useAuthStore.getState().user).toEqual(mockUser);
            expect(useAuthStore.getState().isAuthenticated).toBe(true);
            expect(useAuthStore.getState().isGuest).toBe(false);
        });

        it('stores tokens in secure storage on success', async () => {
            mockAuthApi.register.mockResolvedValue(mockAuthResponse);
            mockSecureStorage.setTokens.mockResolvedValue();

            await useAuthStore.getState().register('test@example.com', 'password', 'Name');

            expect(mockSecureStorage.setTokens).toHaveBeenCalledWith('access-token', 'refresh-token');
        });

        it('sets error on failure', async () => {
            mockAuthApi.register.mockRejectedValue(
                new Error('Email already exists'),
            );

            const success = await useAuthStore.getState().register(
                'exists@example.com',
                'password',
                'Name',
            );

            expect(success).toBe(false);
            expect(useAuthStore.getState().error).toBeTruthy();
        });
    });

    // -------------------------------------------------------------------
    // Logout
    // -------------------------------------------------------------------

    describe('logout', () => {
        it('clears user, tokens, and state', async () => {
            // Setup: logged in state
            useAuthStore.setState({
                user: mockUser,
                isAuthenticated: true,
            });
            mockSecureStorage.getRefreshToken.mockResolvedValue('refresh-token');
            mockSecureStorage.clearTokens.mockResolvedValue();
            mockAuthApi.logout.mockResolvedValue();

            await useAuthStore.getState().logout();

            expect(useAuthStore.getState().user).toBeNull();
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(useAuthStore.getState().isGuest).toBe(false);
            expect(mockSecureStorage.clearTokens).toHaveBeenCalled();
            expect(mockAuthApi.logout).toHaveBeenCalledWith('refresh-token');
        });

        it('clears local state even if API logout fails', async () => {
            useAuthStore.setState({
                user: mockUser,
                isAuthenticated: true,
            });
            mockSecureStorage.getRefreshToken.mockResolvedValue('refresh-token');
            mockSecureStorage.clearTokens.mockResolvedValue();
            mockAuthApi.logout.mockRejectedValue(new Error('Network error'));

            await useAuthStore.getState().logout();

            expect(useAuthStore.getState().user).toBeNull();
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(mockSecureStorage.clearTokens).toHaveBeenCalled();
        });

        it('clears guest state on logout', async () => {
            // Setup: guest mode
            useAuthStore.setState({
                isAuthenticated: true,
                isGuest: true,
                user: null,
            });
            mockSecureStorage.clearTokens.mockResolvedValue();

            await useAuthStore.getState().logout();

            expect(useAuthStore.getState().isGuest).toBe(false);
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });

        it('skips API logout call in guest mode', async () => {
            useAuthStore.setState({
                isAuthenticated: true,
                isGuest: true,
                user: null,
            });
            mockSecureStorage.clearTokens.mockResolvedValue();

            await useAuthStore.getState().logout();

            expect(mockAuthApi.logout).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------
    // Hydrate
    // -------------------------------------------------------------------

    describe('hydrate', () => {
        it('restores user from stored tokens', async () => {
            mockSecureStorage.getAccessToken.mockResolvedValue('valid-token');
            mockAuthApi.getMe.mockResolvedValue(mockUser);

            await useAuthStore.getState().hydrate();

            expect(useAuthStore.getState().user).toEqual(mockUser);
            expect(useAuthStore.getState().isAuthenticated).toBe(true);
            expect(useAuthStore.getState().isHydrated).toBe(true);
            expect(useAuthStore.getState().isLoading).toBe(false);
        });

        it('clears state when no token exists', async () => {
            mockSecureStorage.getAccessToken.mockResolvedValue(null);

            await useAuthStore.getState().hydrate();

            expect(useAuthStore.getState().user).toBeNull();
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(useAuthStore.getState().isHydrated).toBe(true);
        });

        it('clears state when token is invalid', async () => {
            mockSecureStorage.getAccessToken.mockResolvedValue('expired-token');
            mockAuthApi.getMe.mockRejectedValue(new Error('Token expired'));
            mockSecureStorage.clearTokens.mockResolvedValue();

            await useAuthStore.getState().hydrate();

            expect(useAuthStore.getState().user).toBeNull();
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(useAuthStore.getState().isHydrated).toBe(true);
            expect(mockSecureStorage.clearTokens).toHaveBeenCalled();
        });

        it('only runs once (idempotent)', async () => {
            mockSecureStorage.getAccessToken.mockResolvedValue('token');
            mockAuthApi.getMe.mockResolvedValue(mockUser);

            await useAuthStore.getState().hydrate();
            await useAuthStore.getState().hydrate();

            // getMe should only be called once
            expect(mockAuthApi.getMe).toHaveBeenCalledTimes(1);
        });

        it('restores guest mode from MMKV', async () => {
            // Simulate persisted guest flag
            mockMmkvStore['rf_is_guest'] = true;

            await useAuthStore.getState().hydrate();

            expect(useAuthStore.getState().isGuest).toBe(true);
            expect(useAuthStore.getState().isAuthenticated).toBe(true);
            expect(useAuthStore.getState().user).toBeNull();
            expect(useAuthStore.getState().isHydrated).toBe(true);
            // Should NOT have attempted token validation
            expect(mockSecureStorage.getAccessToken).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------
    // continueAsGuest
    // -------------------------------------------------------------------

    describe('continueAsGuest', () => {
        it('sets isAuthenticated and isGuest to true with null user', () => {
            useAuthStore.getState().continueAsGuest();

            expect(useAuthStore.getState().isAuthenticated).toBe(true);
            expect(useAuthStore.getState().isGuest).toBe(true);
            expect(useAuthStore.getState().user).toBeNull();
            expect(useAuthStore.getState().isHydrated).toBe(true);
            expect(useAuthStore.getState().error).toBeNull();
        });

        it('persists guest flag in MMKV', () => {
            useAuthStore.getState().continueAsGuest();

            expect(mockMmkvStore['rf_is_guest']).toBe('true');
        });
    });

    // -------------------------------------------------------------------
    // clearError
    // -------------------------------------------------------------------

    describe('clearError', () => {
        it('resets the error to null', () => {
            useAuthStore.setState({ error: 'Some error' });

            useAuthStore.getState().clearError();

            expect(useAuthStore.getState().error).toBeNull();
        });
    });
});
