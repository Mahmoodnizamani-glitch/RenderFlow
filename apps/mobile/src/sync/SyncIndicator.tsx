/**
 * SyncIndicator — Compact header badge showing sync status.
 *
 * Displays one of four states:
 * - ✓ Synced (green)
 * - ↻ Syncing (animated blue)
 * - ⬡ Offline (gray)
 * - ✗ Error (red)
 */
import React from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useSyncStore } from './useSyncStore';

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

function useSyncingAnimation(isSyncing: boolean): Animated.AnimatedInterpolation<string> {
    const spinValue = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (isSyncing) {
            const animation = Animated.loop(
                Animated.timing(spinValue, {
                    toValue: 1,
                    duration: 1500,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
            );
            animation.start();
            return () => animation.stop();
        } else {
            spinValue.setValue(0);
        }
        return undefined;
    }, [isSyncing, spinValue]);

    return spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SyncIndicatorConfig {
    icon: string;
    color: string;
    label: string;
}

const STATUS_CONFIG: Record<string, SyncIndicatorConfig> = {
    idle: { icon: '✓', color: '#4CAF50', label: 'Synced' },
    syncing: { icon: '↻', color: '#2196F3', label: 'Syncing' },
    offline: { icon: '⬡', color: '#9E9E9E', label: 'Offline' },
    error: { icon: '✗', color: '#F44336', label: 'Error' },
};

export function SyncIndicator(): React.JSX.Element {
    const syncStatus = useSyncStore((s) => s.syncStatus);
    const pendingCount = useSyncStore((s) => s.pendingCount);

    const config = STATUS_CONFIG[syncStatus] ?? STATUS_CONFIG['idle']!;
    const spin = useSyncingAnimation(syncStatus === 'syncing');

    return (
        <View style={styles.container} testID="sync-indicator">
            {syncStatus === 'syncing' ? (
                <Animated.Text
                    style={[
                        styles.icon,
                        { color: config.color, transform: [{ rotate: spin }] },
                    ]}
                >
                    {config.icon}
                </Animated.Text>
            ) : (
                <Text style={[styles.icon, { color: config.color }]}>
                    {config.icon}
                </Text>
            )}
            <Text style={[styles.label, { color: config.color }]}>
                {config.label}
            </Text>
            {pendingCount > 0 && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pendingCount}</Text>
                </View>
            )}
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    icon: {
        fontSize: 14,
        fontWeight: '700',
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
        marginLeft: 4,
    },
    badge: {
        backgroundColor: '#FF9800',
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
});
