/**
 * PlaybackControls component tests.
 *
 * Verifies rendering, play/pause toggle, speed selector,
 * loop toggle, and transport button actions.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../theme';
import { PlaybackControls } from '../PlaybackControls';

function renderWithTheme(ui: React.ReactElement) {
    return render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);
}

const defaultProps = {
    currentFrame: 0,
    durationInFrames: 150,
    fps: 30,
    isPlaying: false,
    playbackSpeed: 1 as const,
    isLooping: true,
    onTogglePlay: jest.fn(),
    onSeek: jest.fn(),
    onSpeedChange: jest.fn(),
    onToggleLoop: jest.fn(),
};

describe('PlaybackControls', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders all main elements', () => {
        const { getByTestId } = renderWithTheme(
            <PlaybackControls {...defaultProps} testID="controls" />,
        );

        expect(getByTestId('controls')).toBeTruthy();
        expect(getByTestId('controls-play-pause')).toBeTruthy();
        expect(getByTestId('controls-progress')).toBeTruthy();
        expect(getByTestId('controls-frame-display')).toBeTruthy();
        expect(getByTestId('controls-time-current')).toBeTruthy();
        expect(getByTestId('controls-time-total')).toBeTruthy();
        expect(getByTestId('controls-loop-toggle')).toBeTruthy();
    });

    it('displays frame counter correctly', () => {
        const { getByTestId } = renderWithTheme(
            <PlaybackControls {...defaultProps} currentFrame={42} testID="controls" />,
        );

        expect(getByTestId('controls-frame-display').props.children).toEqual([42, ' / ', 150]);
    });

    it('displays time display correctly', () => {
        const { getByTestId } = renderWithTheme(
            <PlaybackControls {...defaultProps} currentFrame={90} testID="controls" />,
        );

        // 90 frames at 30fps = 3 seconds = "0:03.00"
        const currentTime = getByTestId('controls-time-current');
        expect(currentTime.props.children).toBe('0:03.00');
    });

    it('calls onTogglePlay when play button is pressed', () => {
        const onTogglePlay = jest.fn();
        const { getByTestId } = renderWithTheme(
            <PlaybackControls {...defaultProps} onTogglePlay={onTogglePlay} testID="controls" />,
        );

        fireEvent.press(getByTestId('controls-play-pause'));
        expect(onTogglePlay).toHaveBeenCalledTimes(1);
    });

    it('calls onSeek(0) when skip-to-start is pressed', () => {
        const onSeek = jest.fn();
        const { getByTestId } = renderWithTheme(
            <PlaybackControls {...defaultProps} currentFrame={50} onSeek={onSeek} testID="controls" />,
        );

        fireEvent.press(getByTestId('controls-skip-start'));
        expect(onSeek).toHaveBeenCalledWith(0);
    });

    it('calls onSeek with last frame when skip-to-end is pressed', () => {
        const onSeek = jest.fn();
        const { getByTestId } = renderWithTheme(
            <PlaybackControls {...defaultProps} onSeek={onSeek} testID="controls" />,
        );

        fireEvent.press(getByTestId('controls-skip-end'));
        expect(onSeek).toHaveBeenCalledWith(149);
    });

    it('calls onSeek with stepped-back frame when step-back is pressed', () => {
        const onSeek = jest.fn();
        const { getByTestId } = renderWithTheme(
            <PlaybackControls {...defaultProps} currentFrame={60} onSeek={onSeek} testID="controls" />,
        );

        fireEvent.press(getByTestId('controls-step-back'));
        // Step back by 1 second (30 frames at 30fps)
        expect(onSeek).toHaveBeenCalledWith(30);
    });

    it('clamps step-back to frame 0', () => {
        const onSeek = jest.fn();
        const { getByTestId } = renderWithTheme(
            <PlaybackControls {...defaultProps} currentFrame={10} onSeek={onSeek} testID="controls" />,
        );

        fireEvent.press(getByTestId('controls-step-back'));
        expect(onSeek).toHaveBeenCalledWith(0);
    });

    it('calls onSpeedChange when a speed chip is pressed', () => {
        const onSpeedChange = jest.fn();
        const { getByTestId } = renderWithTheme(
            <PlaybackControls {...defaultProps} onSpeedChange={onSpeedChange} testID="controls" />,
        );

        fireEvent.press(getByTestId('controls-speed-2'));
        expect(onSpeedChange).toHaveBeenCalledWith(2);
    });

    it('renders all speed chips', () => {
        const { getByTestId } = renderWithTheme(
            <PlaybackControls {...defaultProps} testID="controls" />,
        );

        expect(getByTestId('controls-speed-0.5')).toBeTruthy();
        expect(getByTestId('controls-speed-1')).toBeTruthy();
        expect(getByTestId('controls-speed-1.5')).toBeTruthy();
        expect(getByTestId('controls-speed-2')).toBeTruthy();
    });

    it('calls onToggleLoop when loop button is pressed', () => {
        const onToggleLoop = jest.fn();
        const { getByTestId } = renderWithTheme(
            <PlaybackControls {...defaultProps} onToggleLoop={onToggleLoop} testID="controls" />,
        );

        fireEvent.press(getByTestId('controls-loop-toggle'));
        expect(onToggleLoop).toHaveBeenCalledTimes(1);
    });

    it('displays zero time when fps is zero', () => {
        const { getByTestId } = renderWithTheme(
            <PlaybackControls {...defaultProps} fps={0} currentFrame={50} testID="controls" />,
        );

        const currentTime = getByTestId('controls-time-current');
        expect(currentTime.props.children).toBe('0:00');
    });
});
