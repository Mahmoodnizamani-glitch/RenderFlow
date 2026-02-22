/**
 * Sentry error tracking for the API.
 *
 * Initialises Sentry with the DSN from environment variables.
 * Provides a `captureException` helper for use throughout the API.
 * No-ops gracefully when SENTRY_DSN is not configured.
 */

import type * as SentryTypes from '@sentry/node';

// ---------------------------------------------------------------------------
// Types (avoiding direct Sentry import at module level for tree-shaking)
// ---------------------------------------------------------------------------

let _sentryNode: typeof SentryTypes | null = null;
let _initialised = false;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * Initialise Sentry. No-ops if SENTRY_DSN is not set.
 */
export async function initSentry(options: {
    dsn: string | undefined;
    environment: string;
    release: string;
}): Promise<void> {
    if (!options.dsn || _initialised) return;

    try {
        _sentryNode = await import('@sentry/node');

        _sentryNode.init({
            dsn: options.dsn,
            environment: options.environment,
            release: options.release,
            tracesSampleRate: options.environment === 'production' ? 0.1 : 1.0,
            // Don't send PII
            sendDefaultPii: false,
        });

        _initialised = true;
    } catch {
        // Sentry SDK not installed or init failed — non-blocking
        _sentryNode = null;
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Capture an exception in Sentry. No-ops if Sentry is not initialised.
 */
export function captureException(
    error: unknown,
    context?: Record<string, unknown>,
): void {
    if (!_sentryNode || !_initialised) return;

    _sentryNode.withScope((scope) => {
        if (context) {
            scope.setExtras(context);
        }
        _sentryNode!.captureException(error);
    });
}

/**
 * Set user context for Sentry (called after auth).
 */
export function setUser(userId: string): void {
    if (!_sentryNode || !_initialised) return;
    _sentryNode.setUser({ id: userId });
}

/**
 * Flush pending events before shutdown.
 */
export async function closeSentry(): Promise<void> {
    if (!_sentryNode || !_initialised) return;
    await _sentryNode.close(2000);
}
