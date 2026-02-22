import 'react-native-url-polyfill/auto';
import { useContext, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, ThemeContext } from '../src/theme';
import { runMigrations } from '../src/db';
import { useAuthStore } from '../src/stores';
import { SyncManager } from '../src/sync/SyncManager';
import { useSyncStore } from '../src/sync/useSyncStore';
import { useConnectivity } from '../src/sync/useConnectivity';
import { ConnectivityBanner } from '../src/sync/ConnectivityBanner';
import { SyncRepository } from '../src/sync/SyncRepository';

// ---------------------------------------------------------------------------
// TanStack Query client
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: 2,
        },
    },
});

// ---------------------------------------------------------------------------
// Auth guard — redirects based on authentication state
// ---------------------------------------------------------------------------

function useProtectedRoute() {
    const { isAuthenticated, isHydrated } = useAuthStore();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (!isHydrated) return;

        const inAuthGroup = (segments[0] as string) === '(auth)';

        if (!isAuthenticated && !inAuthGroup) {
            // Not logged in and not on an auth screen → go to login
            router.replace('/(auth)/login' as never);
        } else if (isAuthenticated && inAuthGroup) {
            // Logged in but still on an auth screen → go to tabs
            router.replace('/(tabs)' as never);
        }
    }, [isAuthenticated, isHydrated, segments, router]);
}

// ---------------------------------------------------------------------------
// Sync initialization hook
// ---------------------------------------------------------------------------

function useSyncInit() {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const isGuest = useAuthStore((s) => s.isGuest);
    const setSyncing = useSyncStore((s) => s.setSyncing);
    const setSynced = useSyncStore((s) => s.setSynced);
    const setError = useSyncStore((s) => s.setError);
    const setPendingCount = useSyncStore((s) => s.setPendingCount);

    // Subscribe to SyncManager status changes
    useEffect(() => {
        SyncManager.onStatusChange((status) => {
            switch (status) {
                case 'syncing':
                    setSyncing();
                    break;
                case 'idle':
                    setSynced();
                    break;
                case 'error':
                    setError('Sync failed');
                    break;
                case 'offline':
                    break;
            }
        });
    }, [setSyncing, setSynced, setError]);

    // Update pending count periodically (skip for guests)
    useEffect(() => {
        if (!isAuthenticated || isGuest) return;

        async function updatePendingCount(): Promise<void> {
            try {
                const count = await SyncRepository.getPendingCount();
                setPendingCount(count);
            } catch {
                // Non-critical
            }
        }

        void updatePendingCount();
        const interval = setInterval(() => void updatePendingCount(), 10_000);

        return () => clearInterval(interval);
    }, [isAuthenticated, setPendingCount]);

    // Trigger initial sync when authenticated (skip for guests)
    useEffect(() => {
        if (isAuthenticated && !isGuest) {
            void SyncManager.runFullSync();
        }
    }, [isAuthenticated, isGuest]);

    // Wire connectivity
    useConnectivity();
}

// ---------------------------------------------------------------------------
// App content (inside providers)
// ---------------------------------------------------------------------------

function AppContent() {
    const { isDark, theme } = useContext(ThemeContext);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    useProtectedRoute();
    useSyncInit();

    return (
        <PaperProvider theme={theme} settings={{ icon: props => <MaterialCommunityIcons {...props} /> }}>
            <View style={{ flex: 1 }}>
                {isAuthenticated && <ConnectivityBanner />}
                <Stack
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: theme.colors.background },
                        animation: 'slide_from_right',
                    }}
                >
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen
                        name="project/new"
                        options={{ presentation: 'modal' }}
                    />
                    <Stack.Screen
                        name="project/[id]"
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen
                        name="paywall"
                        options={{ presentation: 'modal', headerShown: false }}
                    />
                    <Stack.Screen
                        name="credits"
                        options={{ presentation: 'modal', headerShown: false }}
                    />
                </Stack>
            </View>
            <StatusBar style={isDark ? 'light' : 'dark'} />
        </PaperProvider>
    );
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

export default function RootLayout() {
    const [dbReady, setDbReady] = useState(false);
    const hydrate = useAuthStore((s) => s.hydrate);
    const isHydrated = useAuthStore((s) => s.isHydrated);
    const [fontsLoaded, fontError] = useFonts({
        ...MaterialCommunityIcons.font,
    });

    useEffect(() => {
        if (fontError) {
            console.error('[RenderFlow] Font load error:', fontError);
        }
    }, [fontError]);

    useEffect(() => {
        let mounted = true;

        async function init(): Promise<void> {
            try {
                // Run DB migrations and auth hydration in parallel
                await Promise.all([
                    runMigrations(),
                    hydrate(),
                ]);
            } catch (error: unknown) {
                // Log but don't crash — the app should remain functional
                console.error('[RenderFlow] Initialization failed:', error);
            } finally {
                if (mounted) {
                    setDbReady(true);
                }
            }
        }

        void init();

        return () => {
            mounted = false;
        };
    }, [hydrate]);

    if (!dbReady || !isHydrated || (!fontsLoaded && !fontError)) {
        // While initializing, render nothing.
        // Expo splash screen covers this period.
        return null;
    }

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <AppContent />
            </ThemeProvider>
        </QueryClientProvider>
    );
}
