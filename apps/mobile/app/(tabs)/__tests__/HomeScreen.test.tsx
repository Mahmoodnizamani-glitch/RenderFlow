/**
 * Home Screen tests.
 *
 * Verifies greeting rendering, quick actions, empty state, recent projects,
 * and stats card behavior.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../src/theme';
import { useProjectStore } from '../../../src/stores';

// Mock loadProjects to be a no-op so useEffect doesn't change isLoading
const mockLoadProjects = jest.fn().mockResolvedValue(undefined);

// Reset store state before each test
beforeEach(() => {
    jest.clearAllMocks();

    useProjectStore.setState({
        projects: [],
        selectedProjectId: null,
        searchQuery: '',
        isLoading: false,
        error: null,
        loadProjects: mockLoadProjects,
    });
});

// Wrapper with PaperProvider
function renderWithTheme(ui: React.ReactElement) {
    return render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);
}

// Valid UUID for test data
const TEST_UUID_1 = 'a0000000-0000-4000-8000-000000000001';
const TEST_UUID_2 = 'b0000000-0000-4000-8000-000000000002';
const NOW = new Date().toISOString();

function makeProject(overrides: Record<string, unknown> = {}) {
    return {
        id: TEST_UUID_1,
        name: 'Test Project',
        description: '',
        code: '',
        thumbnailUri: null,
        compositionWidth: 1920,
        compositionHeight: 1080,
        fps: 30,
        durationInFrames: 150,
        variables: {},
        isFavorite: false,
        syncStatus: 'local' as const,
        remoteId: null,
        createdAt: NOW,
        updatedAt: NOW,
        ...overrides,
    };
}

// Lazy import so mocks are registered first
let HomeScreen: React.ComponentType;
beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    HomeScreen = require('../index').default;
});

describe('HomeScreen', () => {
    it('renders the greeting text', () => {
        const { getByTestId } = renderWithTheme(<HomeScreen />);
        const greeting = getByTestId('home-greeting');
        expect(greeting).toBeTruthy();
        // Greeting should contain one of the time-based greetings
        const text = greeting.props.children.join('');
        expect(text).toMatch(/Good (morning|afternoon|evening), User/);
    });

    it('renders all three quick action buttons', () => {
        const { getByTestId } = renderWithTheme(<HomeScreen />);
        expect(getByTestId('quick-action-new')).toBeTruthy();
        expect(getByTestId('quick-action-paste')).toBeTruthy();
        expect(getByTestId('quick-action-import')).toBeTruthy();
    });

    it('shows empty state when no projects exist', () => {
        const { getByTestId, queryByTestId } = renderWithTheme(<HomeScreen />);
        expect(getByTestId('home-empty-state')).toBeTruthy();
        expect(queryByTestId('home-stats')).toBeNull();
    });

    it('shows stats card when projects exist', () => {
        useProjectStore.setState({
            projects: [makeProject()],
            isLoading: false,
            loadProjects: mockLoadProjects,
        });

        const { getByTestId, queryByTestId } = renderWithTheme(<HomeScreen />);
        expect(getByTestId('home-stats')).toBeTruthy();
        expect(queryByTestId('home-empty-state')).toBeNull();
    });

    it('shows recent projects list when projects exist', () => {
        useProjectStore.setState({
            projects: [
                makeProject({ id: TEST_UUID_1, name: 'Project A' }),
                makeProject({ id: TEST_UUID_2, name: 'Project B' }),
            ],
            isLoading: false,
            loadProjects: mockLoadProjects,
        });

        const { getByTestId } = renderWithTheme(<HomeScreen />);
        expect(getByTestId('recent-projects-list')).toBeTruthy();
    });

    it('navigates to new project when quick action pressed', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useRouter } = require('expo-router');
        const mockPush = jest.fn();
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
            back: jest.fn(),
            replace: jest.fn(),
            navigate: jest.fn(),
        });

        const { getByTestId } = renderWithTheme(<HomeScreen />);
        fireEvent.press(getByTestId('quick-action-new'));
        expect(mockPush).toHaveBeenCalledWith('/project/new');
    });

    it('shows empty state with action button', () => {
        const { getByTestId } = renderWithTheme(<HomeScreen />);
        expect(getByTestId('home-empty-state')).toBeTruthy();
        expect(getByTestId('home-empty-state-action')).toBeTruthy();
    });

    it('displays loading indicator when loading with no projects', () => {
        useProjectStore.setState({
            projects: [],
            isLoading: true,
            loadProjects: mockLoadProjects,
        });

        const { queryByTestId } = renderWithTheme(<HomeScreen />);
        // When loading and no projects, empty state should not show
        expect(queryByTestId('home-empty-state')).toBeNull();
    });
});
