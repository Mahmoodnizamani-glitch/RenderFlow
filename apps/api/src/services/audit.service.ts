/**
 * Audit logging service.
 *
 * Provides append-only audit log writes for security-relevant events.
 * No update or delete operations are exposed by design.
 */
import type { Database } from '../db/connection.js';

import { auditLogs } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditAction =
    | 'login'
    | 'register'
    | 'logout'
    | 'password_change'
    | 'project_create'
    | 'project_delete'
    | 'render_submit'
    | 'render_complete'
    | 'render_fail'
    | 'credit_purchase'
    | 'tier_change'
    | 'data_export'
    | 'account_delete';

export interface AuditEvent {
    userId?: string;
    action: AuditAction;
    resourceType?: string;
    resourceId?: string;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Write (append-only — no update/delete exposed)
// ---------------------------------------------------------------------------

/**
 * Write an audit log entry. Fire-and-forget: failures are logged
 * but never block the request pipeline.
 */
export async function writeAuditLog(
    db: Database,
    event: AuditEvent,
): Promise<void> {
    try {
        await db.insert(auditLogs).values({
            userId: event.userId ?? null,
            action: event.action,
            resourceType: event.resourceType ?? null,
            resourceId: event.resourceId ?? null,
            ip: event.ip ?? null,
            userAgent: event.userAgent ?? null,
            metadata: event.metadata ?? {},
        });
    } catch (err: unknown) {
        // Audit logging must never crash the request. Log and move on.
        // eslint-disable-next-line no-console
        console.error(
            '[audit] Failed to write audit log:',
            err instanceof Error ? err.message : err,
            { action: event.action, userId: event.userId },
        );
    }
}

// ---------------------------------------------------------------------------
// Helper: Extract client IP from Fastify request
// ---------------------------------------------------------------------------

/**
 * Extract the best-effort client IP from a Fastify request.
 * Handles X-Forwarded-For behind reverse proxies.
 */
export function extractClientIp(request: { ip: string }): string {
    return request.ip;
}

/**
 * Extract User-Agent string from request headers.
 */
export function extractUserAgent(
    request: { headers: Record<string, string | string[] | undefined> },
): string | undefined {
    const ua = request.headers['user-agent'];
    if (Array.isArray(ua)) return ua[0];
    return ua;
}
