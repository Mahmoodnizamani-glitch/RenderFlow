/**
 * Connectivity hook — wraps @react-native-community/netinfo.
 *
 * Exposes `isOnline` status and triggers sync on connectivity restoration.
 * Respects the 60-second throttle enforced by SyncManager.
 */
import { useEffect, useState, useRef } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { SyncManager } from './SyncManager';
import { useSyncStore, type SyncStore } from './useSyncStore';

export function useConnectivity(): { isOnline: boolean } {
    const [isOnline, setIsOnline] = useState<boolean>(true);
    const wasOfflineRef = useRef<boolean>(false);
    const setOffline = useSyncStore((s: SyncStore) => s.setOffline);
    const setSynced = useSyncStore((s: SyncStore) => s.setSynced);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            const connected = !!(state.isConnected && state.isInternetReachable !== false);

            setIsOnline(connected);

            if (!connected) {
                wasOfflineRef.current = true;
                setOffline();
                return;
            }

            // Came back online — trigger sync
            if (wasOfflineRef.current) {
                wasOfflineRef.current = false;
                setSynced();
                void SyncManager.runFullSync();
            }
        });

        return () => {
            unsubscribe();
        };
    }, [setOffline, setSynced]);

    return { isOnline };
}
