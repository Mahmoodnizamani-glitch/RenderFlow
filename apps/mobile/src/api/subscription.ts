/**
 * Subscription API client module.
 *
 * Wraps API calls for subscription and usage data.
 */
import { apiClient } from './client';
import { mockUsageSummary } from './mockData';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubscriptionResponse {
    id: string;
    userId: string;
    tier: string;
    status: string;
    provider: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    trialEnd: string | null;
    createdAt: string;
}

export interface UsageResponse {
    creditBalance: number;
    storageUsedBytes: number;
    storageLimitBytes: number;
    rendersToday: number;
    maxRendersPerDay: number;
    tier: string;
}

export interface UsageSummaryResponse {
    usage: UsageResponse;
    subscription: SubscriptionResponse | null;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Fetch the user's current subscription.
 */
export async function getSubscription(): Promise<SubscriptionResponse | null> {
    try {
        const response = await apiClient.get<{ subscription: SubscriptionResponse | null }>(
            '/subscription',
        );
        return response.data.subscription;
    } catch (e) {
        console.warn('Backend unavailable, returning mock subscription');
        return mockUsageSummary.subscription;
    }
}

/**
 * Fetch the user's usage summary including credits, storage, and render count.
 */
export async function getUsageSummary(): Promise<UsageSummaryResponse> {
    try {
        const response = await apiClient.get<UsageSummaryResponse>(
            '/subscription/usage',
        );
        return response.data;
    } catch (e) {
        console.warn('Backend unavailable, returning mock usage summary');
        return mockUsageSummary;
    }
}
