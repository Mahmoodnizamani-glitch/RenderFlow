/**
 * ProjectCard component tests.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../theme';
import { ProjectCard } from '../ProjectCard';
import type { Project } from '@renderflow/shared';

function renderWithTheme(ui: React.ReactElement) {
    return render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);
}

const NOW = new Date().toISOString();

const mockProject: Project = {
    id: 'a0000000-0000-4000-8000-000000000001',
    name: 'My Animation',
    description: 'A cool animation',
    code: 'console.log("hello")',
    thumbnailUri: null,
    compositionWidth: 1920,
    compositionHeight: 1080,
    fps: 60,
    durationInFrames: 300,
    variables: {},
    isFavorite: false,
    syncStatus: 'local',
    remoteId: null,
    createdAt: NOW,
    updatedAt: NOW,
};

describe('ProjectCard', () => {
    it('renders project name', () => {
        const { getByText } = renderWithTheme(
            <ProjectCard project={mockProject} testID="card" />,
        );
        expect(getByText('My Animation')).toBeTruthy();
    });

    it('renders resolution and fps badges', () => {
        const { getByText } = renderWithTheme(
            <ProjectCard project={mockProject} testID="card" />,
        );
        expect(getByText('1920×1080')).toBeTruthy();
        expect(getByText('60fps')).toBeTruthy();
    });

    it('renders description when provided', () => {
        const { getByText } = renderWithTheme(
            <ProjectCard project={mockProject} testID="card" />,
        );
        expect(getByText('A cool animation')).toBeTruthy();
    });

    it('does not render description when empty', () => {
        const noDescProject = { ...mockProject, description: '' };
        const { queryByText } = renderWithTheme(
            <ProjectCard project={noDescProject} testID="card" />,
        );
        expect(queryByText('A cool animation')).toBeNull();
    });

    it('calls onPress when tapped', () => {
        const onPress = jest.fn();
        const { getByTestId } = renderWithTheme(
            <ProjectCard project={mockProject} onPress={onPress} testID="card" />,
        );
        fireEvent.press(getByTestId('card'));
        expect(onPress).toHaveBeenCalledWith(mockProject);
    });

    it('calls onLongPress on long press', () => {
        const onLongPress = jest.fn();
        const { getByTestId } = renderWithTheme(
            <ProjectCard project={mockProject} onLongPress={onLongPress} testID="card" />,
        );
        fireEvent(getByTestId('card'), 'longPress');
        expect(onLongPress).toHaveBeenCalledWith(mockProject);
    });

    it('renders favorite button when onToggleFavorite provided', () => {
        const onToggleFavorite = jest.fn();
        const { getByTestId } = renderWithTheme(
            <ProjectCard
                project={mockProject}
                onToggleFavorite={onToggleFavorite}
                testID="card"
            />,
        );
        expect(getByTestId('card-favorite')).toBeTruthy();
    });

    it('calls onToggleFavorite when favorite button pressed', () => {
        const onToggleFavorite = jest.fn();
        const { getByTestId } = renderWithTheme(
            <ProjectCard
                project={mockProject}
                onToggleFavorite={onToggleFavorite}
                testID="card"
            />,
        );
        fireEvent.press(getByTestId('card-favorite'));
        expect(onToggleFavorite).toHaveBeenCalledWith(mockProject);
    });

    it('renders in compact mode', () => {
        const { getByText, getByTestId } = renderWithTheme(
            <ProjectCard project={mockProject} compact testID="compact-card" />,
        );
        expect(getByTestId('compact-card')).toBeTruthy();
        expect(getByText('My Animation')).toBeTruthy();
    });
});
