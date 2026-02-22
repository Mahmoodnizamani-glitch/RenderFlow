/**
 * Feature gating hook.
 *
 * Provides tier-aware boolean checks for UI gating. Reads from the
 * subscription store and the centralised tier config. Does NOT enforce
 * limits — enforcement happens server-side. This is purely for UX
 * (hiding buttons, showing upgrade prompts).
 */
import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { getTierLimits, isUnlimited, meetsMinimumTier } from '@renderflow/shared';
import type { UserTier } from '@renderflow/shared';

import { useSubscriptionStore } from '../stores/useSubscriptionStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeatureGate {
    /** Current user tier. */
    tier: UserTier;
    /** Whether the user is on a paid plan. */
    isPaid: boolean;
    /** Whether the user can create a new project (under project limit). */
    canCreateProject: (currentProjectCount: number) => boolean;
    /** Whether the user can render at the given height. */
    canRenderAtHeight: (height: number) => boolean;
    /** Whether the user can render today (under daily limit). */
    canRenderToday: () => boolean;
    /** Whether output has a watermark. */
    hasWatermark: boolean;
    /** Whether the tier has a specific feature. */
    hasFeature: (feature: string) => boolean;
    /** Navigate to the paywall screen. */
    showPaywall: () => void;
    /** Navigate to the credits screen. */
    showCredits: () => void;
    /** Storage limit in bytes (-1 = unlimited). */
    storageLimitBytes: number;
    /** Credit balance. */
    creditBalance: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFeatureGate(): FeatureGate {
    const router = useRouter();
    const currentTier = useSubscriptionStore((s) => s.currentTier);
    const creditBalance = useSubscriptionStore((s) => s.creditBalance);
    const usage = useSubscriptionStore((s) => s.usage);

    const limits = useMemo(() => getTierLimits(currentTier), [currentTier]);

    const isPaid = useMemo(
        () => meetsMinimumTier(currentTier, 'pro'),
        [currentTier],
    );

    const canCreateProject = useCallback(
        (currentProjectCount: number): boolean => {
            if (isUnlimited(limits.maxProjects)) return true;
            return currentProjectCount < limits.maxProjects;
        },
        [limits.maxProjects],
    );

    const canRenderAtHeight = useCallback(
        (height: number): boolean => {
            return height <= limits.maxResolutionHeight;
        },
        [limits.maxResolutionHeight],
    );

    const canRenderToday = useCallback((): boolean => {
        if (isUnlimited(limits.maxRendersPerDay)) return true;
        const rendersToday = usage?.rendersToday ?? 0;
        return rendersToday < limits.maxRendersPerDay;
    }, [limits.maxRendersPerDay, usage?.rendersToday]);

    const hasFeature = useCallback(
        (feature: string): boolean => {
            return (limits.features as readonly string[]).includes(feature);
        },
        [limits.features],
    );

    const showPaywall = useCallback((): void => {
        router.push('/paywall' as never);
    }, [router]);

    const showCredits = useCallback((): void => {
        router.push('/credits' as never);
    }, [router]);

    return {
        tier: currentTier,
        isPaid,
        canCreateProject,
        canRenderAtHeight,
        canRenderToday,
        hasWatermark: limits.hasWatermark,
        hasFeature,
        showPaywall,
        showCredits,
        storageLimitBytes: limits.storageBytes,
        creditBalance,
    };
}
