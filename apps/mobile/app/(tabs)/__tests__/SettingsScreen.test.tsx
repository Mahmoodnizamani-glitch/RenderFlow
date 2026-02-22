/**
 * Settings screen tests.
 *
 * Verifies subscription display, usage meters, account info,
 * and logout behavior.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../src/theme';
import { useAuthStore } from '../../../src/stores/useAuthStore';
import { useSubscriptionStore } from '../../../src/stores/useSubscriptionStore';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function renderWithTheme(ui: React.ReactElement) {
    return render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);
}

const mockLoadSubscription = jest.fn().mockResolvedValue(undefined);
const mockLogout = jest.fn().mockResolvedValue(undefined);

function resetStores() {
    useAuthStore.setState({
        user: {
            id: 'user-001',
            email: 'test@example.com',
            displayName: 'Test User',
            avatarUrl: null,
            tier: 'free',
            renderCredits: 5,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            lastLoginAt: null,
        },
        isAuthenticated: true,
        isGuest: false,
        isLoading: false,
        isHydrated: true,
        error: null,
        login: jest.fn(),
        register: jest.fn(),
        logout: mockLogout,
        hydrate: jest.fn(),
        continueAsGuest: jest.fn(),
        clearError: jest.fn(),
        setUser: jest.fn(),
    });

    useSubscriptionStore.setState({
        currentTier: 'free',
        creditBalance: 5,
        usage: {
            storageUsedBytes: 1024 * 1024 * 50, // 50 MB
            rendersToday: 2,
            creditBalance: 5,
            storageLimitBytes: 1024 * 1024 * 500,
            maxRendersPerDay: 10,
            tier: 'free' as const,
        },
        subscription: null,
        isLoading: false,
        error: null,
        loadSubscription: mockLoadSubscription,
    });
}

// ---------------------------------------------------------------------------
// Lazy import
// ---------------------------------------------------------------------------

let SettingsScreen: React.ComponentType;
beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    SettingsScreen = require('../settings').default;
});

beforeEach(() => {
    jest.clearAllMocks();
    resetStores();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SettingsScreen', () => {
    it('renders the subscription section', () => {
        const { getByText } = renderWithTheme(<SettingsScreen />);
        expect(getByText('Subscription')).toBeTruthy();
    });

    it('renders the usage section', () => {
        const { getByText } = renderWithTheme(<SettingsScreen />);
        expect(getByText('Usage')).toBeTruthy();
    });

    it('renders the account section', () => {
        const { getByText } = renderWithTheme(<SettingsScreen />);
        expect(getByText('Account')).toBeTruthy();
    });

    it('displays the user display name', () => {
        const { getByText } = renderWithTheme(<SettingsScreen />);
        expect(getByText('Test User')).toBeTruthy();
    });

    it('displays the user email', () => {
        const { getByText } = renderWithTheme(<SettingsScreen />);
        expect(getByText('test@example.com')).toBeTruthy();
    });

    it('displays the credit balance', () => {
        const { getByText } = renderWithTheme(<SettingsScreen />);
        expect(getByText('5 remaining')).toBeTruthy();
    });

    it('shows "Upgrade" button for free tier users', () => {
        const { getByText } = renderWithTheme(<SettingsScreen />);
        expect(getByText('Upgrade')).toBeTruthy();
    });

    it('shows "Change Plan" button for pro tier users', () => {
        useSubscriptionStore.setState({
            currentTier: 'pro',
            subscription: {
                id: 'sub-001',
                userId: 'user-001',
                tier: 'pro' as const,
                status: 'active',
                provider: 'revenuecat',
                cancelAtPeriodEnd: false,
                currentPeriodEnd: '2026-03-01T00:00:00Z',
                currentPeriodStart: '2026-02-01T00:00:00Z',
                trialEnd: null,
                createdAt: '2026-01-01T00:00:00Z',
            },
        });

        const { getByText } = renderWithTheme(<SettingsScreen />);
        expect(getByText('Change Plan')).toBeTruthy();
    });

    it('calls loadSubscription on mount', () => {
        renderWithTheme(<SettingsScreen />);
        expect(mockLoadSubscription).toHaveBeenCalled();
    });

    it('shows confirmation dialog when logout is pressed', () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        const { getByTestId } = renderWithTheme(<SettingsScreen />);

        fireEvent.press(getByTestId('settings-logout'));

        expect(alertSpy).toHaveBeenCalledWith(
            'Log Out',
            'Are you sure you want to log out?',
            expect.arrayContaining([
                expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
                expect.objectContaining({ text: 'Log Out', style: 'destructive' }),
            ]),
        );

        alertSpy.mockRestore();
    });

    it('calls logout when confirmation dialog is confirmed', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        const { getByTestId } = renderWithTheme(<SettingsScreen />);

        fireEvent.press(getByTestId('settings-logout'));

        // Invoke the destructive "Log Out" callback (second button)
        const buttons = alertSpy.mock.calls[0]?.[2] as Array<{ text: string; onPress?: () => void }>;
        const logOutButton = buttons.find((b) => b.text === 'Log Out');
        logOutButton?.onPress?.();

        await waitFor(() => {
            expect(mockLogout).toHaveBeenCalled();
        });

        alertSpy.mockRestore();
    });

    it('does not call logout when confirmation dialog is cancelled', () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        const { getByTestId } = renderWithTheme(<SettingsScreen />);

        fireEvent.press(getByTestId('settings-logout'));

        // Invoke the "Cancel" callback (first button) — no onPress defined, so nothing happens
        const buttons = alertSpy.mock.calls[0]?.[2] as Array<{ text: string; onPress?: () => void }>;
        const cancelButton = buttons.find((b) => b.text === 'Cancel');
        cancelButton?.onPress?.();

        expect(mockLogout).not.toHaveBeenCalled();

        alertSpy.mockRestore();
    });

    it('shows renders today usage', () => {
        const { getByText } = renderWithTheme(<SettingsScreen />);
        expect(getByText('Renders Today')).toBeTruthy();
    });

    it('shows storage usage label', () => {
        const { getByText } = renderWithTheme(<SettingsScreen />);
        expect(getByText('Storage')).toBeTruthy();
    });

    it('shows subscription status when subscription exists', () => {
        useSubscriptionStore.setState({
            currentTier: 'pro',
            subscription: {
                id: 'sub-001',
                userId: 'user-001',
                tier: 'pro' as const,
                status: 'active',
                provider: 'revenuecat',
                cancelAtPeriodEnd: false,
                currentPeriodEnd: '2026-03-01T00:00:00Z',
                currentPeriodStart: '2026-02-01T00:00:00Z',
                trialEnd: null,
                createdAt: '2026-01-01T00:00:00Z',
            },
        });

        const { getByText } = renderWithTheme(<SettingsScreen />);
        expect(getByText('active')).toBeTruthy();
    });

    // ---------------------------------------------------------------
    // Guest mode
    // ---------------------------------------------------------------

    describe('guest mode', () => {
        beforeEach(() => {
            useAuthStore.setState({
                user: null,
                isAuthenticated: true,
                isGuest: true,
            });
        });

        it('shows Guest Mode label', () => {
            const { getByTestId } = renderWithTheme(<SettingsScreen />);
            expect(getByTestId('guest-mode-label')).toBeTruthy();
        });

        it('shows Sign In button', () => {
            const { getByTestId } = renderWithTheme(<SettingsScreen />);
            expect(getByTestId('guest-sign-in')).toBeTruthy();
        });

        it('does not show logout button', () => {
            const { queryByTestId } = renderWithTheme(<SettingsScreen />);
            expect(queryByTestId('settings-logout')).toBeNull();
        });

        it('shows available features list', () => {
            const { getByText } = renderWithTheme(<SettingsScreen />);
            expect(getByText('Available in Guest Mode')).toBeTruthy();
            expect(getByText('Local Projects')).toBeTruthy();
        });
    });
});
