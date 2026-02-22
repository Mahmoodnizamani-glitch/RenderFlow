/**
 * PlaybackControls — timeline scrubber, play/pause, speed, and loop controls
 * for the Remotion preview player.
 */
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, IconButton, Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { spacing, radii } from '../../theme/tokens';
import { PLAYBACK_SPEEDS } from './previewBridge';
import type { PlaybackSpeed } from './previewBridge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlaybackControlsProps {
    /** Current frame number */
    currentFrame: number;
    /** Total duration in frames */
    durationInFrames: number;
    /** Frames per second */
    fps: number;
    /** Whether playback is active */
    isPlaying: boolean;
    /** Current playback speed */
    playbackSpeed: PlaybackSpeed;
    /** Whether loop mode is enabled */
    isLooping: boolean;
    /** Called when play/pause is toggled */
    onTogglePlay: () => void;
    /** Called when user scrubs the timeline */
    onSeek: (frame: number) => void;
    /** Called when speed is changed */
    onSpeedChange: (speed: PlaybackSpeed) => void;
    /** Called when loop is toggled */
    onToggleLoop: () => void;
    /** Test ID */
    testID?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(frame: number, fps: number): string {
    if (fps <= 0) return '0:00';
    const totalSeconds = frame / fps;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const centiseconds = Math.floor((totalSeconds % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlaybackControls({
    currentFrame,
    durationInFrames,
    fps,
    isPlaying,
    playbackSpeed,
    isLooping,
    onTogglePlay,
    onSeek,
    onSpeedChange,
    onToggleLoop,
    testID = 'playback-controls',
}: PlaybackControlsProps) {
    const theme = useAppTheme();

    const progress = durationInFrames > 0
        ? Math.min(currentFrame / durationInFrames, 1)
        : 0;

    const currentTimeDisplay = useMemo(
        () => formatTime(currentFrame, fps),
        [currentFrame, fps],
    );

    const totalTimeDisplay = useMemo(
        () => formatTime(durationInFrames, fps),
        [durationInFrames, fps],
    );

    // -----------------------------------------------------------------
    // Timeline touch handler — simplified scrubbing via step buttons
    // -----------------------------------------------------------------

    const handleStepBack = useCallback(() => {
        const newFrame = Math.max(0, currentFrame - Math.round(fps));
        onSeek(newFrame);
    }, [currentFrame, fps, onSeek]);

    const handleStepForward = useCallback(() => {
        const newFrame = Math.min(durationInFrames - 1, currentFrame + Math.round(fps));
        onSeek(newFrame);
    }, [currentFrame, durationInFrames, fps, onSeek]);

    const handleSkipToStart = useCallback(() => {
        onSeek(0);
    }, [onSeek]);

    const handleSkipToEnd = useCallback(() => {
        onSeek(Math.max(0, durationInFrames - 1));
    }, [durationInFrames, onSeek]);

    return (
        <View
            style={[styles.container, { backgroundColor: theme.colors.surface }]}
            testID={testID}
        >
            {/* --------------------------------------------------------------- */}
            {/* Timeline progress bar                                            */}
            {/* --------------------------------------------------------------- */}
            <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
                <View
                    style={[
                        styles.progressFill,
                        {
                            backgroundColor: theme.colors.primary,
                            width: `${progress * 100}%`,
                        },
                    ]}
                    testID={`${testID}-progress`}
                />
            </View>

            {/* --------------------------------------------------------------- */}
            {/* Time & frame display                                             */}
            {/* --------------------------------------------------------------- */}
            <View style={styles.timeRow}>
                <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                    testID={`${testID}-time-current`}
                >
                    {currentTimeDisplay}
                </Text>
                <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                    testID={`${testID}-frame-display`}
                >
                    {currentFrame} / {durationInFrames}
                </Text>
                <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                    testID={`${testID}-time-total`}
                >
                    {totalTimeDisplay}
                </Text>
            </View>

            {/* --------------------------------------------------------------- */}
            {/* Main transport controls                                          */}
            {/* --------------------------------------------------------------- */}
            <View style={styles.transportRow}>
                <IconButton
                    icon="skip-previous"
                    size={22}
                    onPress={handleSkipToStart}
                    iconColor={theme.colors.onSurface}
                    testID={`${testID}-skip-start`}
                />
                <IconButton
                    icon="rewind"
                    size={22}
                    onPress={handleStepBack}
                    iconColor={theme.colors.onSurface}
                    testID={`${testID}-step-back`}
                />
                <IconButton
                    icon={isPlaying ? 'pause-circle' : 'play-circle'}
                    size={40}
                    onPress={onTogglePlay}
                    iconColor={theme.colors.primary}
                    testID={`${testID}-play-pause`}
                />
                <IconButton
                    icon="fast-forward"
                    size={22}
                    onPress={handleStepForward}
                    iconColor={theme.colors.onSurface}
                    testID={`${testID}-step-forward`}
                />
                <IconButton
                    icon="skip-next"
                    size={22}
                    onPress={handleSkipToEnd}
                    iconColor={theme.colors.onSurface}
                    testID={`${testID}-skip-end`}
                />
            </View>

            {/* --------------------------------------------------------------- */}
            {/* Speed & loop controls                                            */}
            {/* --------------------------------------------------------------- */}
            <View style={styles.optionsRow}>
                <View style={styles.speedChips}>
                    {PLAYBACK_SPEEDS.map((speed) => (
                        <Chip
                            key={speed}
                            selected={playbackSpeed === speed}
                            onPress={() => onSpeedChange(speed)}
                            compact
                            mode="outlined"
                            style={[
                                styles.chip,
                                playbackSpeed === speed && { backgroundColor: theme.colors.primaryContainer },
                            ]}
                            textStyle={[
                                styles.chipText,
                                { color: playbackSpeed === speed ? theme.colors.primary : theme.colors.onSurfaceVariant },
                            ]}
                            testID={`${testID}-speed-${speed}`}
                        >
                            {speed}x
                        </Chip>
                    ))}
                </View>

                <IconButton
                    icon={isLooping ? 'repeat' : 'repeat-off'}
                    size={20}
                    onPress={onToggleLoop}
                    iconColor={isLooping ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    testID={`${testID}-loop-toggle`}
                />
            </View>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    progressTrack: {
        height: 4,
        borderRadius: radii.full,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: radii.full,
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.xs,
        paddingHorizontal: spacing.xs,
    },
    transportRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    speedChips: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    chip: {
        height: 28,
    },
    chipText: {
        fontSize: 11,
    },
});
