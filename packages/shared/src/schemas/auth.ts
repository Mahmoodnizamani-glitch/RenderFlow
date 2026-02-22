/**
 * @renderflow/shared — Authentication schemas.
 *
 * Zod schemas for auth request/response validation across the API.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const UserTierEnum = z.enum(['free', 'pro', 'team', 'enterprise']);
export type UserTier = z.infer<typeof UserTierEnum>;

// ---------------------------------------------------------------------------
// User response (never includes passwordHash)
// ---------------------------------------------------------------------------

export const UserResponseSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    tier: UserTierEnum,
    renderCredits: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    lastLoginAt: z.string().datetime().nullable(),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;

// ---------------------------------------------------------------------------
// Auth request schemas
// ---------------------------------------------------------------------------

export const RegisterInputSchema = z.object({
    email: z
        .string()
        .email('Invalid email address')
        .transform((v) => v.toLowerCase().trim()),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters'),
    displayName: z
        .string()
        .min(1, 'Display name is required')
        .max(255)
        .trim(),
});

export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
    email: z
        .string()
        .email('Invalid email address')
        .transform((v) => v.toLowerCase().trim()),
    password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RefreshTokenInputSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof RefreshTokenInputSchema>;

export const ChangePasswordInputSchema = z.object({
    oldPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
        .string()
        .min(8, 'New password must be at least 8 characters'),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

// ---------------------------------------------------------------------------
// Auth response schemas
// ---------------------------------------------------------------------------

export const AuthResponseSchema = z.object({
    user: UserResponseSchema,
    accessToken: z.string(),
    refreshToken: z.string(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const MessageResponseSchema = z.object({
    message: z.string(),
});

export type MessageResponse = z.infer<typeof MessageResponseSchema>;
