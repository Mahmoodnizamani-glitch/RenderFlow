/**
 * Background notification service for render job completion.
 *
 * Listens to render store events and triggers local push notifications
 * when a render completes or fails while the app is in the background.
 *
 * Tap action navigates to the render result screen.
 */
import * as Notifications from 'expo-notifications';
import { AppState, type AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import * as socket from '../api/socket';
import type { RenderCompletedPayload, RenderFailedPayload } from '../api/socket';

// ---------------------------------------------------------------------------
// Notification channel setup (Android)
// ---------------------------------------------------------------------------

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
});

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _isInitialized = false;
let _appState: AppStateStatus = AppState.currentState;
let _unsubCompleted: (() => void) | null = null;
let _unsubFailed: (() => void) | null = null;
let _appStateSubscription: { remove: () => void } | null = null;
let _notificationSubscription: Notifications.EventSubscription | null = null;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the notification service.
 * Call once at app startup (e.g., in _layout.tsx).
 */
export async function initRenderNotifications(): Promise<void> {
    if (_isInitialized) return;
    _isInitialized = true;

    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
        console.warn('[notifications] Permission not granted');
        return;
    }

    // Track app state to know when to show notifications
    _appStateSubscription = AppState.addEventListener('change', (state) => {
        _appState = state;
    });

    // Listen for render events via socket handlers
    _unsubCompleted = socket.onRenderCompleted(handleRenderCompleted);
    _unsubFailed = socket.onRenderFailed(handleRenderFailed);

    // Handle notification tap → navigate to render screen
    _notificationSubscription = Notifications.addNotificationResponseReceivedListener(
        handleNotificationTap,
    );
}

/**
 * Tear down the notification service.
 */
export function teardownRenderNotifications(): void {
    _unsubCompleted?.();
    _unsubFailed?.();
    _appStateSubscription?.remove();
    _notificationSubscription?.remove();
    _isInitialized = false;
    _unsubCompleted = null;
    _unsubFailed = null;
    _appStateSubscription = null;
    _notificationSubscription = null;
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function handleRenderCompleted(payload: RenderCompletedPayload): void {
    // Only show notification if app is in background
    if (_appState === 'active') return;

    void scheduleNotification({
        title: '✅ Render Complete!',
        body: 'Your video is ready to download.',
        data: { jobId: payload.jobId, type: 'render_completed' as const },
    });
}

function handleRenderFailed(payload: RenderFailedPayload): void {
    if (_appState === 'active') return;

    void scheduleNotification({
        title: '❌ Render Failed',
        body: payload.errorMessage || 'Something went wrong with your render.',
        data: { jobId: payload.jobId, type: 'render_failed' as const },
    });
}

function handleNotificationTap(response: Notifications.NotificationResponse): void {
    const data = response.notification.request.content.data as
        | { jobId?: string; type?: string }
        | undefined;

    if (data?.jobId) {
        router.push(`/render/${data.jobId}` as never);
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function scheduleNotification(content: {
    title: string;
    body: string;
    data: Record<string, unknown>;
}): Promise<void> {
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: content.title,
                body: content.body,
                data: content.data,
                sound: true,
            },
            trigger: null, // Immediate
        });
    } catch (error: unknown) {
        console.error('[notifications] Failed to schedule notification:', error);
    }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** @internal — test only */
export function _resetForTests(): void {
    teardownRenderNotifications();
}
