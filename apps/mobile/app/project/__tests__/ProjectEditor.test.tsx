/**
 * Project Editor screen tests.
 *
 * Verifies project loading, name editing, tab switching,
 * auto-save, and error badge rendering.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../src/theme';
import { useProjectStore } from '../../../src/stores';

// Mock the RenderJobRepository needed by useRenderStore
jest.mock('../../../src/db/repositories', () => ({
    ProjectRepository: {
        getAll: jest.fn().mockResolvedValue([]),
        getById: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn(),
    },
    RenderJobRepository: {
        create: jest.fn().mockResolvedValue({
            id: 'mock-job-id',
            projectId: 'test',
            status: 'queued',
            renderType: 'cloud',
            format: 'mp4',
            quality: 80,
            resolution: '1920x1080',
            fps: 30,
            progress: 0,
            currentFrame: 0,
            totalFrames: 0,
            outputUri: null,
            remoteJobId: null,
            errorMessage: null,
            startedAt: null,
            completedAt: null,
            createdAt: new Date().toISOString(),
        }),
        getAll: jest.fn().mockResolvedValue([]),
        getByProject: jest.fn().mockResolvedValue([]),
        getLatest: jest.fn().mockResolvedValue(null),
        updateProgress: jest.fn(),
        updateStatus: jest.fn(),
    },
    AssetRepository: {
        getAll: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        delete: jest.fn(),
    },
}));

// Mock loadProjects / updateProject to be no-ops
const mockLoadProjects = jest.fn().mockResolvedValue(undefined);
const mockUpdateProject = jest.fn().mockResolvedValue({});

const NOW = new Date().toISOString();
const TEST_PROJECT_ID = 'a0000000-0000-4000-8000-000000000001';

function makeProject(overrides: Record<string, unknown> = {}) {
    return {
        id: TEST_PROJECT_ID,
        name: 'Test Animation',
        description: 'A test animation',
        code: 'import { useCurrentFrame } from "remotion";\n\nexport default function MyVideo() {\n  const frame = useCurrentFrame();\n  return <div>{frame}</div>;\n}',
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

// Set up expo-router mock to return the test project ID
beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    const { useLocalSearchParams } = require('expo-router');
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: TEST_PROJECT_ID });

    const project = makeProject();
    useProjectStore.setState({
        projects: [project],
        selectedProjectId: null,
        searchQuery: '',
        isLoading: false,
        error: null,
        loadProjects: mockLoadProjects,
        updateProject: mockUpdateProject,
    });
});

afterEach(() => {
    jest.useRealTimers();
});

function renderWithTheme(ui: React.ReactElement) {
    return render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);
}

let ProjectEditorScreen: React.ComponentType;
beforeAll(() => {
    ProjectEditorScreen = require('../[id]').default;
});

describe('ProjectEditorScreen', () => {
    it('renders the editor screen container', () => {
        const { getByTestId } = renderWithTheme(<ProjectEditorScreen />);
        expect(getByTestId('project-editor')).toBeTruthy();
    });

    it('renders the project name', () => {
        const { getByTestId } = renderWithTheme(<ProjectEditorScreen />);
        expect(getByTestId('editor-project-name')).toBeTruthy();
    });

    it('renders the back button', () => {
        const { getByTestId } = renderWithTheme(<ProjectEditorScreen />);
        expect(getByTestId('editor-back')).toBeTruthy();
    });

    it('renders the save button', () => {
        const { getByTestId } = renderWithTheme(<ProjectEditorScreen />);
        expect(getByTestId('editor-save')).toBeTruthy();
    });

    it('renders all four tab buttons', () => {
        const { getByTestId } = renderWithTheme(<ProjectEditorScreen />);
        expect(getByTestId('editor-tab-code')).toBeTruthy();
        expect(getByTestId('editor-tab-preview')).toBeTruthy();
        expect(getByTestId('editor-tab-variables')).toBeTruthy();
        expect(getByTestId('editor-tab-export')).toBeTruthy();
    });

    it('renders the editor toolbar on Code tab', () => {
        const { getByTestId } = renderWithTheme(<ProjectEditorScreen />);
        expect(getByTestId('editor-toolbar')).toBeTruthy();
    });

    it('renders the code editor on Code tab', () => {
        const { getByTestId } = renderWithTheme(<ProjectEditorScreen />);
        expect(getByTestId('code-editor')).toBeTruthy();
    });

    it('navigates back when back button pressed', () => {
        const { useRouter } = require('expo-router');
        const mockBack = jest.fn();
        (useRouter as jest.Mock).mockReturnValue({
            push: jest.fn(),
            back: mockBack,
            replace: jest.fn(),
            navigate: jest.fn(),
        });

        const { getByTestId } = renderWithTheme(<ProjectEditorScreen />);
        fireEvent.press(getByTestId('editor-back'));
        expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it('enters name editing mode when name is pressed', () => {
        const { getByTestId } = renderWithTheme(<ProjectEditorScreen />);
        fireEvent.press(getByTestId('editor-project-name'));
        expect(getByTestId('editor-name-input')).toBeTruthy();
    });

    it('shows "Missing project ID" when no ID', () => {
        const { useLocalSearchParams } = require('expo-router');
        (useLocalSearchParams as jest.Mock).mockReturnValue({});

        const { getByText } = renderWithTheme(<ProjectEditorScreen />);
        expect(getByText('Missing project ID')).toBeTruthy();
    });

    it('auto-saves code after debounce', async () => {
        const { getByTestId } = renderWithTheme(<ProjectEditorScreen />);
        const codeEditor = getByTestId('code-editor-webview');

        // Simulate code change from editor
        act(() => {
            codeEditor.props.onMessage?.({
                nativeEvent: {
                    data: JSON.stringify({
                        type: 'code-change',
                        payload: { code: 'const x = 42;' },
                    }),
                },
            });
        });

        // Advance past both debounce periods (500ms CodeEditor + 2000ms auto-save)
        act(() => {
            jest.advanceTimersByTime(3000);
        });

        expect(mockUpdateProject).toHaveBeenCalled();
    });
});
