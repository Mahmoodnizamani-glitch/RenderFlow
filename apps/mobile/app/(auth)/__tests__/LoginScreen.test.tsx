/**
 * Login screen tests.
 *
 * Verifies rendering, Zod validation, form submission, error display,
 * and navigation to register.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../src/theme';
import { useAuthStore } from '../../../src/stores';
import type { AuthStore } from '../../../src/stores/useAuthStore';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function renderWithTheme(ui: React.ReactElement) {
    return render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);
}

const mockLogin = jest.fn().mockResolvedValue(true);

function resetAuthStore(overrides: Partial<AuthStore> = {}) {
    useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isHydrated: true,
        error: null,
        login: mockLogin,
        register: jest.fn(),
        logout: jest.fn(),
        hydrate: jest.fn(),
        clearError: jest.fn(),
        setUser: jest.fn(),
        ...overrides,
    });
}

// ---------------------------------------------------------------------------
// Lazy import so mocks are registered first
// ---------------------------------------------------------------------------

let LoginScreen: React.ComponentType;
beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    LoginScreen = require('../login').default;
});

beforeEach(() => {
    jest.clearAllMocks();
    resetAuthStore();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoginScreen', () => {
    it('renders the login form elements', () => {
        const { getByTestId } = renderWithTheme(<LoginScreen />);
        expect(getByTestId('login-email-input')).toBeTruthy();
        expect(getByTestId('login-password-input')).toBeTruthy();
        expect(getByTestId('login-submit-button')).toBeTruthy();
    });

    it('renders the app title', () => {
        const { getByText } = renderWithTheme(<LoginScreen />);
        expect(getByText('RenderFlow')).toBeTruthy();
    });

    it('renders the subtitle', () => {
        const { getByText } = renderWithTheme(<LoginScreen />);
        expect(getByText('Sign in to your account')).toBeTruthy();
    });

    it('shows email validation error for empty email', async () => {
        const { getByTestId, findByTestId } = renderWithTheme(<LoginScreen />);

        // Set only password, leave email empty
        fireEvent.changeText(getByTestId('login-password-input'), 'password123');
        fireEvent.press(getByTestId('login-submit-button'));

        const errorEl = await findByTestId('login-email-error');
        expect(errorEl).toBeTruthy();
    });

    it('shows email validation error for invalid email format', async () => {
        const { getByTestId, findByTestId } = renderWithTheme(<LoginScreen />);

        fireEvent.changeText(getByTestId('login-email-input'), 'not-an-email');
        fireEvent.changeText(getByTestId('login-password-input'), 'password123');
        fireEvent.press(getByTestId('login-submit-button'));

        const errorEl = await findByTestId('login-email-error');
        expect(errorEl).toBeTruthy();
    });

    it('shows password validation error for empty password', async () => {
        const { getByTestId, findByTestId } = renderWithTheme(<LoginScreen />);

        fireEvent.changeText(getByTestId('login-email-input'), 'test@example.com');
        fireEvent.press(getByTestId('login-submit-button'));

        const errorEl = await findByTestId('login-password-error');
        expect(errorEl).toBeTruthy();
    });

    it('calls login with valid credentials', async () => {
        const { getByTestId } = renderWithTheme(<LoginScreen />);

        fireEvent.changeText(getByTestId('login-email-input'), 'test@example.com');
        fireEvent.changeText(getByTestId('login-password-input'), 'password123');
        fireEvent.press(getByTestId('login-submit-button'));

        await waitFor(() => {
            expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
        });
    });

    it('normalizes email to lowercase before login', async () => {
        const { getByTestId } = renderWithTheme(<LoginScreen />);

        fireEvent.changeText(getByTestId('login-email-input'), 'USER@Test.COM');
        fireEvent.changeText(getByTestId('login-password-input'), 'password123');
        fireEvent.press(getByTestId('login-submit-button'));

        await waitFor(() => {
            expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'password123');
        });
    });

    it('shows loading state when isLoading is true', () => {
        resetAuthStore({ isLoading: true });
        const { getByText } = renderWithTheme(<LoginScreen />);
        expect(getByText('Signing in…')).toBeTruthy();
    });

    it('displays API error from store', () => {
        resetAuthStore({ error: 'Invalid credentials' });
        const { getByText } = renderWithTheme(<LoginScreen />);
        expect(getByText('Invalid credentials')).toBeTruthy();
    });

    it('navigates to register screen when "Register" is pressed', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useRouter } = require('expo-router');
        const mockPush = jest.fn();
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
            back: jest.fn(),
            replace: jest.fn(),
            navigate: jest.fn(),
        });

        const { getByText } = renderWithTheme(<LoginScreen />);
        fireEvent.press(getByText('Register'));

        expect(mockPush).toHaveBeenCalledWith('/(auth)/register');
    });

    it('does not call login when form has validation errors', async () => {
        const { getByTestId } = renderWithTheme(<LoginScreen />);

        // Submit with empty form
        fireEvent.press(getByTestId('login-submit-button'));

        await waitFor(() => {
            expect(mockLogin).not.toHaveBeenCalled();
        });
    });
});
