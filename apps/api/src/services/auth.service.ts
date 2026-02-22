/**
 * Authentication service.
 *
 * Handles user registration, login, token management (JWT access + refresh
 * with rotation), password changes, and profile retrieval.
 *
 * All database operations use the Drizzle client. Passwords are hashed
 * with bcryptjs (cost factor 12). Refresh tokens are stored as SHA-256
 * hashes for security.
 */
import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import type { UserResponse } from '@renderflow/shared';
import type { Database } from '../db/connection.js';
import { users, refreshTokens } from '../db/schema.js';
import { AppError } from '../errors/errors.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BCRYPT_COST = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

export interface JwtSigner {
    sign(payload: Record<string, unknown>, options?: { expiresIn: string }): string;
}

export interface JwtVerifier {
    verify<T = Record<string, unknown>>(token: string): T;
}

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(
    password: string,
    hash: string,
): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshTokenValue(): string {
    return crypto.randomBytes(48).toString('base64url');
}

function toUserResponse(row: {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    tier: string;
    renderCredits: number;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
}): UserResponse {
    return {
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        tier: row.tier as UserResponse['tier'],
        renderCredits: row.renderCredits,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    };
}

// ---------------------------------------------------------------------------
// Token pair generation
// ---------------------------------------------------------------------------

export async function generateTokenPair(
    db: Database,
    userId: string,
    jwtSigner: JwtSigner,
): Promise<TokenPair> {
    const accessToken = jwtSigner.sign(
        { sub: userId },
        { expiresIn: ACCESS_TOKEN_EXPIRY },
    );

    const rawRefreshToken = generateRefreshTokenValue();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

    await db.insert(refreshTokens).values({
        userId,
        tokenHash,
        expiresAt,
    });

    return {
        accessToken,
        refreshToken: rawRefreshToken,
    };
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export async function register(
    db: Database,
    email: string,
    password: string,
    displayName: string,
    jwtSigner: JwtSigner,
): Promise<{ user: UserResponse; tokens: TokenPair }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing user
    const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

    if (existing.length > 0) {
        throw AppError.conflict('A user with this email already exists');
    }

    const passwordHash = await hashPassword(password);

    const [inserted] = await db
        .insert(users)
        .values({
            email: normalizedEmail,
            passwordHash,
            displayName,
        })
        .returning();

    if (!inserted) {
        throw AppError.internal('Failed to create user');
    }

    const tokens = await generateTokenPair(db, inserted.id, jwtSigner);
    const user = toUserResponse(inserted);

    return { user, tokens };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(
    db: Database,
    email: string,
    password: string,
    jwtSigner: JwtSigner,
): Promise<{ user: UserResponse; tokens: TokenPair }> {
    const normalizedEmail = email.toLowerCase().trim();

    const [found] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

    if (!found) {
        throw AppError.unauthorized('Invalid email or password');
    }

    const valid = await verifyPassword(password, found.passwordHash);
    if (!valid) {
        throw AppError.unauthorized('Invalid email or password');
    }

    // Update lastLoginAt
    await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, found.id));

    const tokens = await generateTokenPair(db, found.id, jwtSigner);
    const user = toUserResponse({ ...found, lastLoginAt: new Date() });

    return { user, tokens };
}

// ---------------------------------------------------------------------------
// Refresh token
// ---------------------------------------------------------------------------

export async function refreshAccessToken(
    db: Database,
    rawRefreshToken: string,
    jwtSigner: JwtSigner,
): Promise<{ user: UserResponse; tokens: TokenPair }> {
    const tokenHash = hashToken(rawRefreshToken);

    // Find the refresh token record
    const [tokenRecord] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);

    if (!tokenRecord) {
        // Token not found — could be a reused/rotated token.
        // We cannot determine the userId from just a missing token hash,
        // so we simply reject.
        throw AppError.unauthorized('Invalid refresh token');
    }

    // Check expiry
    if (tokenRecord.expiresAt < new Date()) {
        // Clean up expired token
        await db
            .delete(refreshTokens)
            .where(eq(refreshTokens.id, tokenRecord.id));

        throw AppError.unauthorized('Refresh token has expired');
    }

    // Rotate: delete old token FIRST, then issue new pair
    await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.id, tokenRecord.id));

    // Fetch user
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, tokenRecord.userId))
        .limit(1);

    if (!user) {
        throw AppError.unauthorized('User not found');
    }

    const tokens = await generateTokenPair(db, user.id, jwtSigner);

    return { user: toUserResponse(user), tokens };
}

/**
 * Detect refresh token reuse — invalidate ALL tokens for the user.
 * Call this when you suspect a stolen token is being replayed.
 */
export async function invalidateAllUserTokens(
    db: Database,
    userId: string,
): Promise<void> {
    await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.userId, userId));
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logout(
    db: Database,
    rawRefreshToken: string,
): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);

    await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash));
}

// ---------------------------------------------------------------------------
// Change password
// ---------------------------------------------------------------------------

export async function changePassword(
    db: Database,
    userId: string,
    oldPassword: string,
    newPassword: string,
): Promise<void> {
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user) {
        throw AppError.notFound('User not found');
    }

    const valid = await verifyPassword(oldPassword, user.passwordHash);
    if (!valid) {
        throw AppError.unauthorized('Current password is incorrect');
    }

    const newHash = await hashPassword(newPassword);

    await db
        .update(users)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(users.id, userId));

    // Invalidate all refresh tokens — force re-login on other devices
    await invalidateAllUserTokens(db, userId);
}

// ---------------------------------------------------------------------------
// Get user profile
// ---------------------------------------------------------------------------

export async function getUserProfile(
    db: Database,
    userId: string,
): Promise<UserResponse> {
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user) {
        throw AppError.notFound('User not found');
    }

    return toUserResponse(user);
}
