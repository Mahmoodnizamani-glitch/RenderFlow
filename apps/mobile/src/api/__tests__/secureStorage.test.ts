/**
 * Tests for secure token storage.
 */
import * as SecureStore from 'expo-secure-store';

import {
    setTokens,
    getAccessToken,
    getRefreshToken,
    clearTokens,
} from '../secureStorage';

// Access the mock's internal store for assertions
const mockStore = (SecureStore as unknown as { __store: Map<string, string> }).__store;

describe('secureStorage', () => {
    beforeEach(() => {
        mockStore.clear();
        jest.clearAllMocks();
    });

    describe('setTokens', () => {
        it('stores both access and refresh tokens', async () => {
            await setTokens('access-123', 'refresh-456');

            expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(2);
            expect(mockStore.get('rf_access_token')).toBe('access-123');
            expect(mockStore.get('rf_refresh_token')).toBe('refresh-456');
        });
    });

    describe('getAccessToken', () => {
        it('returns the stored access token', async () => {
            mockStore.set('rf_access_token', 'my-token');

            const token = await getAccessToken();
            expect(token).toBe('my-token');
        });

        it('returns null when no token is stored', async () => {
            const token = await getAccessToken();
            expect(token).toBeNull();
        });
    });

    describe('getRefreshToken', () => {
        it('returns the stored refresh token', async () => {
            mockStore.set('rf_refresh_token', 'my-refresh');

            const token = await getRefreshToken();
            expect(token).toBe('my-refresh');
        });

        it('returns null when no token is stored', async () => {
            const token = await getRefreshToken();
            expect(token).toBeNull();
        });
    });

    describe('clearTokens', () => {
        it('removes both tokens', async () => {
            mockStore.set('rf_access_token', 'access-123');
            mockStore.set('rf_refresh_token', 'refresh-456');

            await clearTokens();

            expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(2);
            expect(mockStore.has('rf_access_token')).toBe(false);
            expect(mockStore.has('rf_refresh_token')).toBe(false);
        });

        it('does not throw when tokens do not exist', async () => {
            await expect(clearTokens()).resolves.not.toThrow();
        });
    });
});
