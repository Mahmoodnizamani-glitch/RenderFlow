/**
 * Auth API module.
 *
 * Type-safe wrappers around the authentication endpoints.
 * Uses shared Zod schemas for response validation.
 */
import type { UserResponse } from '@renderflow/shared';
import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthTokenResponse {
    user: UserResponse;
    accessToken: string;
    refreshToken: string;
}

interface MeResponse {
    user: UserResponse;
}

interface MessageResponse {
    message: string;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/**
 * Register a new account. Returns user + token pair.
 */
export async function register(
    email: string,
    password: string,
    displayName: string,
): Promise<AuthTokenResponse> {
    const response = await apiClient.post<AuthTokenResponse>('/auth/register', {
        email: email.toLowerCase().trim(),
        password,
        displayName: displayName.trim(),
    });
    return response.data;
}

/**
 * Log in with email and password. Returns user + token pair.
 */
export async function login(
    email: string,
    password: string,
): Promise<AuthTokenResponse> {
    const response = await apiClient.post<AuthTokenResponse>('/auth/login', {
        email: email.toLowerCase().trim(),
        password,
    });
    return response.data;
}

/**
 * Refresh the access token using a refresh token.
 */
export async function refreshToken(
    token: string,
): Promise<AuthTokenResponse> {
    const response = await apiClient.post<AuthTokenResponse>('/auth/refresh', {
        refreshToken: token,
    });
    return response.data;
}

/**
 * Log out (invalidate the refresh token server-side).
 */
export async function logout(token: string): Promise<void> {
    await apiClient.post<MessageResponse>('/auth/logout', {
        refreshToken: token,
    });
}

/**
 * Change the current user's password.
 */
export async function changePassword(
    oldPassword: string,
    newPassword: string,
): Promise<void> {
    await apiClient.post<MessageResponse>('/auth/change-password', {
        oldPassword,
        newPassword,
    });
}

/**
 * Get the currently authenticated user's profile.
 */
export async function getMe(): Promise<UserResponse> {
    const response = await apiClient.get<MeResponse>('/auth/me');
    return response.data.user;
}
