/**
 * ConnectivityBanner — Animated banner shown when the device is offline.
 *
 * Slides in from the top when offline, slides out when back online.
 * Non-blocking: doesn't prevent interaction with the app.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSyncStore } from './useSyncStore';

const BANNER_HEIGHT = 36;

export function ConnectivityBanner(): React.JSX.Element | null {
    const syncStatus = useSyncStore((s) => s.syncStatus);
    const isOffline = syncStatus === 'offline';
    const translateY = useRef(new Animated.Value(-BANNER_HEIGHT)).current;
    const isVisible = useRef(false);

    useEffect(() => {
        if (isOffline && !isVisible.current) {
            isVisible.current = true;
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 10,
            }).start();
        } else if (!isOffline && isVisible.current) {
            isVisible.current = false;
            Animated.timing(translateY, {
                toValue: -BANNER_HEIGHT,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [isOffline, translateY]);

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY }] },
            ]}
            testID="connectivity-banner"
            pointerEvents="none"
        >
            <View style={styles.inner}>
                <Text style={styles.icon}>⬡</Text>
                <Text style={styles.text}>
                    You&apos;re offline. Changes will sync when you reconnect.
                </Text>
            </View>
        </Animated.View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: BANNER_HEIGHT,
        zIndex: 1000,
    },
    inner: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#616161',
        paddingHorizontal: 16,
    },
    icon: {
        color: '#FFFFFF',
        fontSize: 12,
        marginRight: 6,
    },
    text: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '500',
    },
});
