/**
 * Tests for the useFeatureGate hook.
 */
import { renderHook } from '@testing-library/react-native';
import { useFeatureGate } from '../useFeatureGate';
import { useSubscriptionStore } from '../../stores/useSubscriptionStore';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../api/purchases');
jest.mock('../../api/subscription');
jest.mock('../../api/errors', () => ({
    extractApiError: (err: unknown) => ({
        message: err instanceof Error ? err.message : 'Unknown error',
        code: 'UNKNOWN',
    }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setTier(tier: 'free' | 'pro' | 'team' | 'enterprise'): void {
    useSubscriptionStore.setState({
        currentTier: tier,
        creditBalance: tier === 'free' ? 0 : 100,
        usage: {
            creditBalance: tier === 'free' ? 0 : 100,
            storageUsedBytes: 0,
            storageLimitBytes: 1024 * 1024 * 1024,
            rendersToday: 0,
            maxRendersPerDay: tier === 'free' ? 5 : 50,
            tier,
        },
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useFeatureGate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useSubscriptionStore.setState({
            currentTier: 'free',
            isProOrAbove: false,
            creditBalance: 0,
            usage: null,
        });
    });

    describe('tier checks', () => {
        it('returns free tier by default', () => {
            const { result } = renderHook(() => useFeatureGate());
            expect(result.current.tier).toBe('free');
            expect(result.current.isPaid).toBe(false);
        });

        it('returns isPaid true for pro tier', () => {
            setTier('pro');
            const { result } = renderHook(() => useFeatureGate());
            expect(result.current.isPaid).toBe(true);
        });
    });

    describe('canCreateProject', () => {
        it('allows creation under free limit', () => {
            setTier('free');
            const { result } = renderHook(() => useFeatureGate());
            expect(result.current.canCreateProject(2)).toBe(true);
        });

        it('blocks creation at free limit', () => {
            setTier('free');
            const { result } = renderHook(() => useFeatureGate());
            // Free tier limit is 3 projects
            expect(result.current.canCreateProject(3)).toBe(false);
        });

        it('allows unlimited projects for pro', () => {
            setTier('pro');
            const { result } = renderHook(() => useFeatureGate());
            expect(result.current.canCreateProject(100)).toBe(true);
        });
    });

    describe('watermark', () => {
        it('free tier has watermark', () => {
            setTier('free');
            const { result } = renderHook(() => useFeatureGate());
            expect(result.current.hasWatermark).toBe(true);
        });

        it('pro tier has no watermark', () => {
            setTier('pro');
            const { result } = renderHook(() => useFeatureGate());
            expect(result.current.hasWatermark).toBe(false);
        });
    });

    describe('navigation', () => {
        it('showPaywall navigates to /paywall', () => {
            const { result } = renderHook(() => useFeatureGate());
            result.current.showPaywall();
            expect(mockPush).toHaveBeenCalledWith('/paywall');
        });

        it('showCredits navigates to /credits', () => {
            const { result } = renderHook(() => useFeatureGate());
            result.current.showCredits();
            expect(mockPush).toHaveBeenCalledWith('/credits');
        });
    });

    describe('canRenderToday', () => {
        it('returns true when under daily limit', () => {
            setTier('free');
            useSubscriptionStore.setState({
                usage: {
                    creditBalance: 0,
                    storageUsedBytes: 0,
                    storageLimitBytes: 1024 * 1024 * 1024,
                    rendersToday: 2,
                    maxRendersPerDay: 5,
                    tier: 'free',
                },
            });
            const { result } = renderHook(() => useFeatureGate());
            expect(result.current.canRenderToday()).toBe(true);
        });

        it('returns false when at daily limit', () => {
            setTier('free');
            useSubscriptionStore.setState({
                usage: {
                    creditBalance: 0,
                    storageUsedBytes: 0,
                    storageLimitBytes: 1024 * 1024 * 1024,
                    rendersToday: 5,
                    maxRendersPerDay: 5,
                    tier: 'free',
                },
            });
            const { result } = renderHook(() => useFeatureGate());
            expect(result.current.canRenderToday()).toBe(false);
        });
    });
});
