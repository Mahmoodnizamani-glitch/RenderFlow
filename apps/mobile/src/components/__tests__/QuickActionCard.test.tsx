/**
 * QuickActionCard / StatsCard component tests.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../theme';
import { QuickActionCard } from '../QuickActionCard';
import { StatsCard } from '../StatsCard';

function renderWithTheme(ui: React.ReactElement) {
    return render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);
}

describe('QuickActionCard', () => {
    it('renders label text', () => {
        const { getByText } = renderWithTheme(
            <QuickActionCard icon="plus" label="New Project" onPress={jest.fn()} />,
        );
        expect(getByText('New Project')).toBeTruthy();
    });

    it('calls onPress when tapped', () => {
        const onPress = jest.fn();
        const { getByTestId } = renderWithTheme(
            <QuickActionCard
                icon="plus"
                label="New Project"
                onPress={onPress}
                testID="qa-card"
            />,
        );
        fireEvent.press(getByTestId('qa-card'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('sets accessibility label', () => {
        const { getByLabelText } = renderWithTheme(
            <QuickActionCard icon="plus" label="Create" onPress={jest.fn()} />,
        );
        expect(getByLabelText('Create')).toBeTruthy();
    });
});

describe('StatsCard', () => {
    it('renders all stat items', () => {
        const items = [
            { icon: 'folder', label: 'Projects', value: '5' },
            { icon: 'movie', label: 'Renders', value: '12' },
            { icon: 'database', label: 'Storage', value: '2.3 MB' },
        ];

        const { getByText } = renderWithTheme(
            <StatsCard items={items} testID="stats" />,
        );

        expect(getByText('5')).toBeTruthy();
        expect(getByText('Projects')).toBeTruthy();
        expect(getByText('12')).toBeTruthy();
        expect(getByText('Renders')).toBeTruthy();
        expect(getByText('2.3 MB')).toBeTruthy();
        expect(getByText('Storage')).toBeTruthy();
    });

    it('renders empty when no items', () => {
        const { queryByText } = renderWithTheme(
            <StatsCard items={[]} testID="stats-empty" />,
        );
        expect(queryByText('Projects')).toBeNull();
    });
});
