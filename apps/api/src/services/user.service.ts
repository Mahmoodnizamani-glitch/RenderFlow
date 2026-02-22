/**
 * User service for GDPR compliance.
 *
 * Provides data export and soft-delete (PII anonymisation) functionality.
 */
import { eq } from 'drizzle-orm';

import type { Database } from '../db/connection.js';
import { users, projects, assets, renderJobs, subscriptions, auditLogs } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserDataExport {
    user: Record<string, unknown>;
    projects: Record<string, unknown>[];
    assets: Record<string, unknown>[];
    renderJobs: Record<string, unknown>[];
    subscriptions: Record<string, unknown>[];
    auditLogs: Record<string, unknown>[];
    exportedAt: string;
}

// ---------------------------------------------------------------------------
// Data Export
// ---------------------------------------------------------------------------

/**
 * Export all user data as a JSON-serialisable object.
 * Complies with GDPR Article 20 (right to data portability).
 */
export async function exportUserData(
    db: Database,
    userId: string,
): Promise<UserDataExport> {
    const [userData, userProjects, userAssets, userRenderJobs, userSubscriptions, userAuditLogs] =
        await Promise.all([
            db.select().from(users).where(eq(users.id, userId)).limit(1),
            db.select().from(projects).where(eq(projects.userId, userId)),
            db.select().from(assets).where(eq(assets.userId, userId)),
            db.select().from(renderJobs).where(eq(renderJobs.userId, userId)),
            db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
            db.select().from(auditLogs).where(eq(auditLogs.userId, userId)),
        ]);

    const user = userData[0];
    if (!user) {
        throw new Error('User not found');
    }

    // Omit password hash from export
    const { passwordHash: _ph, ...safeUser } = user;

    return {
        user: safeUser as Record<string, unknown>,
        projects: userProjects as unknown as Record<string, unknown>[],
        assets: userAssets as unknown as Record<string, unknown>[],
        renderJobs: userRenderJobs as unknown as Record<string, unknown>[],
        subscriptions: userSubscriptions as unknown as Record<string, unknown>[],
        auditLogs: userAuditLogs as unknown as Record<string, unknown>[],
        exportedAt: new Date().toISOString(),
    };
}

// ---------------------------------------------------------------------------
// Account Deletion (soft-delete via PII anonymisation)
// ---------------------------------------------------------------------------

/**
 * Anonymise a user's PII for GDPR Article 17 (right to erasure).
 *
 * Instead of hard-deleting, we:
 * 1. Replace email with a hashed placeholder
 * 2. Clear display name and avatar
 * 3. Invalidate the password hash
 *
 * This preserves referential integrity while removing personal data.
 */
export async function softDeleteUser(
    db: Database,
    userId: string,
): Promise<void> {
    const anonymisedEmail = `deleted-${userId.slice(0, 8)}@anonymised.renderflow`;

    await db
        .update(users)
        .set({
            email: anonymisedEmail,
            displayName: null,
            avatarUrl: null,
            passwordHash: 'ACCOUNT_DELETED',
            settings: {},
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
}
