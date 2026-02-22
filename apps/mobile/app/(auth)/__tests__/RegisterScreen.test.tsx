/**
 * Register screen tests.
 *
 * Verifies rendering, Zod validation (including password match),
 * terms checkbox, form submission, and navigation to login.
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

const mockRegister = jest.fn().mockResolvedValue(true);

function resetAuthStore(overrides: Partial<AuthStore> = {}) {
    useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isHydrated: true,
        error: null,
        login: jest.fn(),
        register: mockRegister,
        logout: jest.fn(),
        hydrate: jest.fn(),
        clearError: jest.fn(),
        setUser: jest.fn(),
        ...overrides,
    });
}

// ---------------------------------------------------------------------------
// Lazy import
// ---------------------------------------------------------------------------

let RegisterScreen: React.ComponentType;
beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RegisterScreen = require('../register').default;
});

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetAuthStore();
});

afterEach(() => {
    // Flush pending RN Animated timers to prevent teardown errors
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RegisterScreen', () => {
    it('renders all form elements', () => {
        const { getByTestId } = renderWithTheme(<RegisterScreen />);
        expect(getByTestId('register-name-input')).toBeTruthy();
        expect(getByTestId('register-email-input')).toBeTruthy();
        expect(getByTestId('register-password-input')).toBeTruthy();
        expect(getByTestId('register-confirm-password-input')).toBeTruthy();
        expect(getByTestId('register-terms-checkbox')).toBeTruthy();
        expect(getByTestId('register-submit-button')).toBeTruthy();
    });

    it('renders the title and subtitle', () => {
        const { getAllByText, getByText } = renderWithTheme(<RegisterScreen />);
        // 'Create Account' appears in both the heading and the submit button
        expect(getAllByText('Create Account').length).toBeGreaterThanOrEqual(1);
        expect(getByText('Start creating stunning renders')).toBeTruthy();
    });

    it('shows validation error for empty display name', async () => {
        const { getByTestId, findByTestId } = renderWithTheme(<RegisterScreen />);

        // Accept terms and fill other fields but leave name empty
        fireEvent.press(getByTestId('register-terms-checkbox'));
        fireEvent.changeText(getByTestId('register-email-input'), 'test@example.com');
        fireEvent.changeText(getByTestId('register-password-input'), 'password123');
        fireEvent.changeText(getByTestId('register-confirm-password-input'), 'password123');
        fireEvent.press(getByTestId('register-submit-button'));

        const errorEl = await findByTestId('register-name-error');
        expect(errorEl).toBeTruthy();
    });

    it('shows validation error for invalid email', async () => {
        const { getByTestId, findByTestId } = renderWithTheme(<RegisterScreen />);

        fireEvent.press(getByTestId('register-terms-checkbox'));
        fireEvent.changeText(getByTestId('register-name-input'), 'Test User');
        fireEvent.changeText(getByTestId('register-email-input'), 'bad-email');
        fireEvent.changeText(getByTestId('register-password-input'), 'password123');
        fireEvent.changeText(getByTestId('register-confirm-password-input'), 'password123');
        fireEvent.press(getByTestId('register-submit-button'));

        const errorEl = await findByTestId('register-email-error');
        expect(errorEl).toBeTruthy();
    });

    it('shows validation error for short password', async () => {
        const { getByTestId, findByTestId } = renderWithTheme(<RegisterScreen />);

        fireEvent.press(getByTestId('register-terms-checkbox'));
        fireEvent.changeText(getByTestId('register-name-input'), 'Test User');
        fireEvent.changeText(getByTestId('register-email-input'), 'test@example.com');
        fireEvent.changeText(getByTestId('register-password-input'), 'short');
        fireEvent.changeText(getByTestId('register-confirm-password-input'), 'short');
        fireEvent.press(getByTestId('register-submit-button'));

        const errorEl = await findByTestId('register-password-error');
        expect(errorEl).toBeTruthy();
    });

    it('shows validation error for mismatched passwords', async () => {
        const { getByTestId, findByTestId } = renderWithTheme(<RegisterScreen />);

        fireEvent.press(getByTestId('register-terms-checkbox'));
        fireEvent.changeText(getByTestId('register-name-input'), 'Test User');
        fireEvent.changeText(getByTestId('register-email-input'), 'test@example.com');
        fireEvent.changeText(getByTestId('register-password-input'), 'password123');
        fireEvent.changeText(getByTestId('register-confirm-password-input'), 'password456');
        fireEvent.press(getByTestId('register-submit-button'));

        const errorEl = await findByTestId('register-confirm-error');
        expect(errorEl).toBeTruthy();
    });

    it('shows terms error when terms are not accepted', async () => {
        const { getByTestId, findByTestId } = renderWithTheme(<RegisterScreen />);

        fireEvent.changeText(getByTestId('register-name-input'), 'Test User');
        fireEvent.changeText(getByTestId('register-email-input'), 'test@example.com');
        fireEvent.changeText(getByTestId('register-password-input'), 'password123');
        fireEvent.changeText(getByTestId('register-confirm-password-input'), 'password123');
        fireEvent.press(getByTestId('register-submit-button'));

        const errorEl = await findByTestId('register-terms-error');
        expect(errorEl).toBeTruthy();
    });

    it('calls register with valid data and accepted terms', async () => {
        const { getByTestId } = renderWithTheme(<RegisterScreen />);

        fireEvent.press(getByTestId('register-terms-checkbox'));
        fireEvent.changeText(getByTestId('register-name-input'), 'Test User');
        fireEvent.changeText(getByTestId('register-email-input'), 'test@example.com');
        fireEvent.changeText(getByTestId('register-password-input'), 'password123');
        fireEvent.changeText(getByTestId('register-confirm-password-input'), 'password123');
        fireEvent.press(getByTestId('register-submit-button'));

        await waitFor(() => {
            expect(mockRegister).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User');
        });
    });

    it('normalizes email to lowercase', async () => {
        const { getByTestId } = renderWithTheme(<RegisterScreen />);

        fireEvent.press(getByTestId('register-terms-checkbox'));
        fireEvent.changeText(getByTestId('register-name-input'), 'User');
        fireEvent.changeText(getByTestId('register-email-input'), 'USER@Test.COM');
        fireEvent.changeText(getByTestId('register-password-input'), 'password123');
        fireEvent.changeText(getByTestId('register-confirm-password-input'), 'password123');
        fireEvent.press(getByTestId('register-submit-button'));

        await waitFor(() => {
            expect(mockRegister).toHaveBeenCalledWith('user@test.com', 'password123', 'User');
        });
    });

    it('shows loading state when isLoading is true', () => {
        resetAuthStore({ isLoading: true });
        const { getByText } = renderWithTheme(<RegisterScreen />);
        expect(getByText('Creating account…')).toBeTruthy();
    });

    it('displays API error from store', () => {
        resetAuthStore({ error: 'Email already taken' });
        const { getByText } = renderWithTheme(<RegisterScreen />);
        expect(getByText('Email already taken')).toBeTruthy();
    });

    it('navigates back to login when "Sign In" is pressed', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useRouter } = require('expo-router');
        const mockBack = jest.fn();
        (useRouter as jest.Mock).mockReturnValue({
            push: jest.fn(),
            back: mockBack,
            replace: jest.fn(),
            navigate: jest.fn(),
        });

        const { getByText } = renderWithTheme(<RegisterScreen />);
        fireEvent.press(getByText('Sign In'));

        expect(mockBack).toHaveBeenCalled();
    });

    it('does not call register when form has validation errors', async () => {
        const { getByTestId } = renderWithTheme(<RegisterScreen />);

        // Accept terms but leave all fields empty
        fireEvent.press(getByTestId('register-terms-checkbox'));
        fireEvent.press(getByTestId('register-submit-button'));

        await waitFor(() => {
            expect(mockRegister).not.toHaveBeenCalled();
        });
    });
});
