/**
 * Tests for the UpgradePrompt component.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { UpgradePrompt } from '../UpgradePrompt';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWith(props: Partial<React.ComponentProps<typeof UpgradePrompt>> = {}) {
    return render(
        <PaperProvider>
            <UpgradePrompt
                title="Project limit reached"
                description="Upgrade to create more"
                {...props}
            />
        </PaperProvider>,
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UpgradePrompt', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the title and description', () => {
        const { getByText } = renderWith();
        expect(getByText('Project limit reached')).toBeTruthy();
        expect(getByText('Upgrade to create more')).toBeTruthy();
    });

    it('renders the default Upgrade button', () => {
        const { getByText } = renderWith();
        expect(getByText('Upgrade')).toBeTruthy();
    });

    it('renders custom CTA label', () => {
        const { getByText } = renderWith({ ctaLabel: 'Go Pro' });
        expect(getByText('Go Pro')).toBeTruthy();
    });

    it('navigates to paywall on button press', () => {
        const { getByTestId } = renderWith({ testID: 'test-prompt' });
        fireEvent.press(getByTestId('test-prompt-button'));
        expect(mockPush).toHaveBeenCalledWith('/paywall');
    });

    it('uses default testID when not provided', () => {
        const { getByTestId } = renderWith();
        expect(getByTestId('upgrade-prompt')).toBeTruthy();
    });
});
