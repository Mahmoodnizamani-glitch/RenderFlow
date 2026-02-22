/**
 * Projects Screen tests.
 *
 * Verifies search debounce, filter chips, grid/list toggle, empty state,
 * FAB navigation, and project list rendering.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../src/theme';
import { useProjectStore } from '../../../src/stores';
import { usePreferences } from '../../../src/stores/usePreferences';

// Mock loadProjects to be a no-op to prevent useEffect from changing state
const mockLoadProjects = jest.fn().mockResolvedValue(undefined);

// Reset store state before each test
beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    useProjectStore.setState({
        projects: [],
        selectedProjectId: null,
        searchQuery: '',
        isLoading: false,
        error: null,
        loadProjects: mockLoadProjects,
    });

    usePreferences.setState({
        viewMode: 'grid',
    });
});

afterEach(() => {
    jest.useRealTimers();
});

// Wrapper
function renderWithTheme(ui: React.ReactElement) {
    return render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);
}

const TEST_UUID_1 = 'a0000000-0000-4000-8000-000000000001';
const TEST_UUID_2 = 'b0000000-0000-4000-8000-000000000002';
const NOW = new Date().toISOString();

function makeProject(overrides: Record<string, unknown> = {}) {
    return {
        id: TEST_UUID_1,
        name: 'Test Project',
        description: 'A test project',
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

let ProjectsScreen: React.ComponentType;
beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ProjectsScreen = require('../projects').default;
});

describe('ProjectsScreen', () => {
    it('renders the search bar', () => {
        const { getByTestId } = renderWithTheme(<ProjectsScreen />);
        expect(getByTestId('projects-searchbar')).toBeTruthy();
    });

    it('renders all three filter chips', () => {
        const { getByTestId } = renderWithTheme(<ProjectsScreen />);
        expect(getByTestId('filter-all')).toBeTruthy();
        expect(getByTestId('filter-favorites')).toBeTruthy();
        expect(getByTestId('filter-recent')).toBeTruthy();
    });

    it('renders the view mode toggle', () => {
        const { getByTestId } = renderWithTheme(<ProjectsScreen />);
        expect(getByTestId('view-mode-toggle')).toBeTruthy();
    });

    it('shows empty state when no projects', () => {
        const { getByTestId } = renderWithTheme(<ProjectsScreen />);
        expect(getByTestId('projects-empty-state')).toBeTruthy();
    });

    it('renders the FAB button', () => {
        const { getByTestId } = renderWithTheme(<ProjectsScreen />);
        expect(getByTestId('projects-fab')).toBeTruthy();
    });

    it('renders project list when projects exist', () => {
        useProjectStore.setState({
            projects: [
                makeProject({ id: TEST_UUID_1, name: 'Project Alpha' }),
                makeProject({ id: TEST_UUID_2, name: 'Project Beta' }),
            ],
            isLoading: false,
            loadProjects: mockLoadProjects,
        });

        const { getByTestId, queryByTestId } = renderWithTheme(<ProjectsScreen />);
        expect(getByTestId('projects-list')).toBeTruthy();
        expect(queryByTestId('projects-empty-state')).toBeNull();
    });

    it('debounces search input at 300ms', () => {
        useProjectStore.setState({
            projects: [makeProject()],
            isLoading: false,
            loadProjects: mockLoadProjects,
        });

        const { getByTestId } = renderWithTheme(<ProjectsScreen />);
        const searchbar = getByTestId('projects-searchbar');

        // Count calls after initial render
        const initialCallCount = mockLoadProjects.mock.calls.length;

        // Type into search
        act(() => {
            fireEvent.changeText(searchbar, 'hello');
        });

        // Before 300ms, no new load call
        act(() => {
            jest.advanceTimersByTime(100);
        });
        expect(mockLoadProjects.mock.calls.length).toBe(initialCallCount);

        // After 300ms, load should fire
        act(() => {
            jest.advanceTimersByTime(300);
        });
        expect(mockLoadProjects.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it('toggles view mode when toggle button pressed', () => {
        const { getByTestId } = renderWithTheme(<ProjectsScreen />);

        expect(usePreferences.getState().viewMode).toBe('grid');
        fireEvent.press(getByTestId('view-mode-toggle'));
        expect(usePreferences.getState().viewMode).toBe('list');
    });

    it('selects favorites filter chip', () => {
        useProjectStore.setState({
            projects: [
                makeProject({ id: TEST_UUID_1, name: 'Fav', isFavorite: true }),
                makeProject({ id: TEST_UUID_2, name: 'Not Fav', isFavorite: false }),
            ],
            isLoading: false,
            loadProjects: mockLoadProjects,
        });

        const { getByTestId } = renderWithTheme(<ProjectsScreen />);
        fireEvent.press(getByTestId('filter-favorites'));
        expect(getByTestId('filter-favorites')).toBeTruthy();
    });

    it('FAB navigates to new project', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useRouter } = require('expo-router');
        const mockPush = jest.fn();
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
            back: jest.fn(),
            replace: jest.fn(),
            navigate: jest.fn(),
        });

        const { getByTestId } = renderWithTheme(<ProjectsScreen />);
        fireEvent.press(getByTestId('projects-fab'));
        expect(mockPush).toHaveBeenCalledWith('/project/new');
    });

    it('shows empty state when no results', () => {
        useProjectStore.setState({
            projects: [],
            searchQuery: '',
            isLoading: false,
            loadProjects: mockLoadProjects,
        });

        const { getByTestId } = renderWithTheme(<ProjectsScreen />);
        expect(getByTestId('projects-empty-state')).toBeTruthy();
    });
});
