/**
 * Tests for the auth API module.
 */
import * as authApi from '../auth';
import { apiClient } from '../client';

// Mock the apiClient methods
jest.mock('../client', () => ({
    apiClient: {
        post: jest.fn(),
        get: jest.fn(),
    },
    API_BASE_URL: 'http://localhost:3001',
    onTokenCleared: jest.fn(),
}));

const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

describe('auth API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

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

    describe('register', () => {
        it('calls POST /auth/register with trimmed lowercase email', async () => {
            mockPost.mockResolvedValue({ data: mockAuthResponse });

            const result = await authApi.register('  Test@Example.COM  ', 'password123', '  John Doe  ');

            expect(mockPost).toHaveBeenCalledWith('/auth/register', {
                email: 'test@example.com',
                password: 'password123',
                displayName: 'John Doe',
            });
            expect(result).toEqual(mockAuthResponse);
        });
    });

    describe('login', () => {
        it('calls POST /auth/login with trimmed lowercase email', async () => {
            mockPost.mockResolvedValue({ data: mockAuthResponse });

            const result = await authApi.login('  Test@Example.COM  ', 'password123');

            expect(mockPost).toHaveBeenCalledWith('/auth/login', {
                email: 'test@example.com',
                password: 'password123',
            });
            expect(result).toEqual(mockAuthResponse);
        });
    });

    describe('refreshToken', () => {
        it('calls POST /auth/refresh with the token', async () => {
            mockPost.mockResolvedValue({ data: mockAuthResponse });

            const result = await authApi.refreshToken('old-refresh-token');

            expect(mockPost).toHaveBeenCalledWith('/auth/refresh', {
                refreshToken: 'old-refresh-token',
            });
            expect(result).toEqual(mockAuthResponse);
        });
    });

    describe('logout', () => {
        it('calls POST /auth/logout with the refresh token', async () => {
            mockPost.mockResolvedValue({ data: { message: 'Logged out' } });

            await authApi.logout('refresh-token');

            expect(mockPost).toHaveBeenCalledWith('/auth/logout', {
                refreshToken: 'refresh-token',
            });
        });
    });

    describe('changePassword', () => {
        it('calls POST /auth/change-password', async () => {
            mockPost.mockResolvedValue({ data: { message: 'Password changed' } });

            await authApi.changePassword('oldPassword', 'newPassword');

            expect(mockPost).toHaveBeenCalledWith('/auth/change-password', {
                oldPassword: 'oldPassword',
                newPassword: 'newPassword',
            });
        });
    });

    describe('getMe', () => {
        it('calls GET /auth/me and returns the user', async () => {
            mockGet.mockResolvedValue({ data: { user: mockUser } });

            const result = await authApi.getMe();

            expect(mockGet).toHaveBeenCalledWith('/auth/me');
            expect(result).toEqual(mockUser);
        });
    });
});
