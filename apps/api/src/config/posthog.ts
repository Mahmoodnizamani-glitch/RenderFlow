/**
 * PostHog server-side analytics.
 *
 * Tracks key business events from the API. No-ops gracefully
 * when POSTHOG_API_KEY is not configured.
 *
 * For mobile analytics, install `posthog-react-native` in the
 * mobile app (see ops/posthog-setup.md).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PostHogClient {
    capture(event: {
        distinctId: string;
        event: string;
        properties?: Record<string, unknown>;
    }): void;
    shutdown(): Promise<void>;
}

let _client: PostHogClient | null = null;
let _initialised = false;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * Initialise PostHog. No-ops if API key is not set.
 */
export async function initPostHog(apiKey: string | undefined): Promise<void> {
    if (!apiKey || _initialised) return;

    try {
        const { PostHog } = await import('posthog-node');
        _client = new PostHog(apiKey, {
            host: 'https://us.i.posthog.com',
            flushAt: 20,
            flushInterval: 10000, // 10 seconds
        });
        _initialised = true;
    } catch {
        // posthog-node not installed — non-blocking
        _client = null;
    }
}

// ---------------------------------------------------------------------------
// Event tracking
// ---------------------------------------------------------------------------

/**
 * Track a server-side event. No-ops if PostHog is not initialised.
 */
export function trackEvent(
    userId: string,
    event: string,
    properties?: Record<string, unknown>,
): void {
    if (!_client || !_initialised) return;

    _client.capture({
        distinctId: userId,
        event,
        properties: {
            ...properties,
            source: 'api',
        },
    });
}

// ---------------------------------------------------------------------------
// Predefined events
// ---------------------------------------------------------------------------

export function trackRenderSubmitted(userId: string, props: {
    projectId: string;
    creditsCharged: number;
    format: string;
}): void {
    trackEvent(userId, 'render_submitted', props);
}

export function trackRenderCompleted(userId: string, props: {
    renderJobId: string;
    durationMs: number;
    format: string;
}): void {
    trackEvent(userId, 'render_completed', props);
}

export function trackRenderFailed(userId: string, props: {
    renderJobId: string;
    error: string;
}): void {
    trackEvent(userId, 'render_failed', props);
}

export function trackCreditPurchase(userId: string, props: {
    amount: number;
    credits: number;
    provider: string;
}): void {
    trackEvent(userId, 'credit_purchased', props);
}

export function trackSubscriptionStarted(userId: string, props: {
    tier: string;
    provider: string;
}): void {
    trackEvent(userId, 'subscription_started', props);
}

// ---------------------------------------------------------------------------
// Shutdown
// ---------------------------------------------------------------------------

/**
 * Flush pending events and close the client.
 */
export async function shutdownPostHog(): Promise<void> {
    if (!_client || !_initialised) return;
    await _client.shutdown();
    _client = null;
    _initialised = false;
}
