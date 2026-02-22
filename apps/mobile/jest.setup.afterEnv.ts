/**
 * Jest setup file that runs AFTER the test framework is installed.
 * Jest globals (jest.mock, expect, etc.) are available here.
 */

// Mock expo-font to prevent "loadedNativeFonts.forEach is not a function"
jest.mock('expo-font', () => ({
    isLoaded: () => true,
    loadAsync: jest.fn().mockResolvedValue(undefined),
    isLoading: () => false,
    useFonts: () => [true, null],
}));

// Mock @expo/vector-icons to avoid font loading issues in tests
jest.mock('@expo/vector-icons', () => {
    const { Text } = require('react-native');
    const createMockIcon = () => {
        return function MockIcon(props: { name?: string; testID?: string }) {
            return Text({ children: props.name || 'icon', testID: props.testID });
        };
    };
    return {
        __esModule: true,
        default: createMockIcon(),
        MaterialCommunityIcons: createMockIcon(),
        MaterialIcons: createMockIcon(),
        Ionicons: createMockIcon(),
        FontAwesome: createMockIcon(),
        createIconSet: () => createMockIcon(),
    };
});

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
    setStringAsync: jest.fn().mockResolvedValue(undefined),
    getStringAsync: jest.fn().mockResolvedValue(''),
}));

// ---------------------------------------------------------------------------
// Database mocks (expo-sqlite, expo-crypto)
// ---------------------------------------------------------------------------

// Mock expo-crypto for UUID generation
jest.mock('expo-crypto', () => ({
    randomUUID: jest.fn(() => {
        // Simple deterministic but unique-enough UUID for tests
        const hex = '0123456789abcdef';
        let uuid = '';
        for (let i = 0; i < 36; i++) {
            if (i === 8 || i === 13 || i === 18 || i === 23) {
                uuid += '-';
            } else if (i === 14) {
                uuid += '4';
            } else {
                uuid += hex[Math.floor(Math.random() * 16)];
            }
        }
        return uuid;
    }),
}));

// Mock expo-sqlite — provides a minimal in-memory store for Drizzle
jest.mock('expo-sqlite', () => {
    return {
        openDatabaseSync: jest.fn(() => ({
            execSync: jest.fn(),
            runSync: jest.fn(),
            getFirstSync: jest.fn(() => null),
            closeSync: jest.fn(),
        })),
    };
});

// ---------------------------------------------------------------------------
// MMKV mock — in-memory Map-backed store for tests
// ---------------------------------------------------------------------------

jest.mock('react-native-mmkv', () => {
    const stores = new Map<string, Map<string, string>>();

    class MockMMKV {
        private _store: Map<string, string>;
        constructor(config?: { id?: string }) {
            const id = config?.id ?? 'default';
            if (!stores.has(id)) {
                stores.set(id, new Map());
            }
            this._store = stores.get(id)!;
        }
        getString(key: string): string | undefined {
            return this._store.get(key);
        }
        set(key: string, value: string): void {
            this._store.set(key, value);
        }
        delete(key: string): void {
            this._store.delete(key);
        }
        contains(key: string): boolean {
            return this._store.has(key);
        }
        getAllKeys(): string[] {
            return Array.from(this._store.keys());
        }
        clearAll(): void {
            this._store.clear();
        }
    }

    return { MMKV: MockMMKV };
});

// ---------------------------------------------------------------------------
// FlashList mock — renders as a simple FlatList in tests
// ---------------------------------------------------------------------------

jest.mock('@shopify/flash-list', () => {
    const { FlatList } = require('react-native');
    return {
        __esModule: true,
        FlashList: FlatList,
    };
});

// ---------------------------------------------------------------------------
// expo-document-picker mock
// ---------------------------------------------------------------------------

jest.mock('expo-document-picker', () => ({
    getDocumentAsync: jest.fn().mockResolvedValue({
        canceled: true,
        assets: [],
    }),
}));

// ---------------------------------------------------------------------------
// expo-router mock
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({
    useRouter: jest.fn(() => ({
        push: jest.fn(),
        back: jest.fn(),
        replace: jest.fn(),
        navigate: jest.fn(),
    })),
    useLocalSearchParams: jest.fn(() => ({})),
    useSegments: jest.fn(() => []),
    usePathname: jest.fn(() => '/'),
    Link: 'Link',
    Tabs: {
        Screen: 'TabsScreen',
    },
    Stack: {
        Screen: 'StackScreen',
    },
    router: {
        push: jest.fn(),
        back: jest.fn(),
        replace: jest.fn(),
        navigate: jest.fn(),
    },
}));

// ---------------------------------------------------------------------------
// react-native-webview mock — renders as a View with onMessage support
// ---------------------------------------------------------------------------

jest.mock('react-native-webview', () => {
    const { View } = require('react-native');
    const React = require('react');

    const MockWebView = React.forwardRef(
        function MockWebView(props: Record<string, unknown>, ref: React.Ref<unknown>) {
            React.useImperativeHandle(ref, () => ({
                injectJavaScript: jest.fn(),
            }));
            return React.createElement(View, {
                testID: props.testID || 'mock-webview',
                ...props,
            });
        },
    );

    return {
        __esModule: true,
        default: MockWebView,
        WebView: MockWebView,
    };
});

// ---------------------------------------------------------------------------
// expo-secure-store mock — in-memory Map-backed store for tests
// ---------------------------------------------------------------------------

jest.mock('expo-secure-store', () => {
    const store = new Map<string, string>();
    return {
        setItemAsync: jest.fn(async (key: string, value: string) => {
            store.set(key, value);
        }),
        getItemAsync: jest.fn(async (key: string) => {
            return store.get(key) ?? null;
        }),
        deleteItemAsync: jest.fn(async (key: string) => {
            store.delete(key);
        }),
        __store: store,
    };
});

// ---------------------------------------------------------------------------
// expo-constants mock — provides API URL for the client
// ---------------------------------------------------------------------------

jest.mock('expo-constants', () => ({
    expoConfig: {
        extra: {
            apiUrl: 'http://localhost:3001',
        },
    },
    manifest: null,
}));

// ---------------------------------------------------------------------------
// @react-native-community/netinfo mock — always online by default
// ---------------------------------------------------------------------------

jest.mock('@react-native-community/netinfo', () => {
    const listeners: Array<(state: { isConnected: boolean; isInternetReachable: boolean }) => void> = [];

    return {
        addEventListener: jest.fn((listener: (state: { isConnected: boolean; isInternetReachable: boolean }) => void) => {
            listeners.push(listener);
            listener({ isConnected: true, isInternetReachable: true });
            return () => {
                const idx = listeners.indexOf(listener);
                if (idx >= 0) listeners.splice(idx, 1);
            };
        }),
        fetch: jest.fn().mockResolvedValue({
            isConnected: true,
            isInternetReachable: true,
            type: 'wifi',
        }),
        __listeners: listeners,
    };
});

// ---------------------------------------------------------------------------
// expo-file-system mock
// ---------------------------------------------------------------------------

jest.mock('expo-file-system', () => ({
    cacheDirectory: '/mock-cache/',
    documentDirectory: '/mock-documents/',
    downloadAsync: jest.fn().mockResolvedValue({ uri: '/mock-cache/download.mp4', status: 200 }),
    readAsStringAsync: jest.fn().mockResolvedValue(''),
    writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
    deleteAsync: jest.fn().mockResolvedValue(undefined),
    getInfoAsync: jest.fn().mockResolvedValue({ exists: false, isDirectory: false, size: 0 }),
    makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// expo-sharing mock
// ---------------------------------------------------------------------------

jest.mock('expo-sharing', () => ({
    isAvailableAsync: jest.fn().mockResolvedValue(true),
    shareAsync: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// expo-media-library mock
// ---------------------------------------------------------------------------

jest.mock('expo-media-library', () => ({
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    createAssetAsync: jest.fn().mockResolvedValue({ id: 'mock-asset-id', uri: '/mock-asset' }),
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));

// ---------------------------------------------------------------------------
// expo-notifications mock
// ---------------------------------------------------------------------------

jest.mock('expo-notifications', () => ({
    setNotificationHandler: jest.fn(),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-notification-id'),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    AndroidNotificationPriority: { HIGH: 'high' },
}));

// ---------------------------------------------------------------------------
// socket.io-client mock
// ---------------------------------------------------------------------------

jest.mock('socket.io-client', () => {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    let _connected = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockSocket: any = {
        connected: false,
        auth: {},
        on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event]!.push(handler);
            return mockSocket;
        }),
        off: jest.fn((event: string, handler?: (...args: unknown[]) => void) => {
            if (handler && listeners[event]) {
                listeners[event] = listeners[event]!.filter((h) => h !== handler);
            } else {
                delete listeners[event];
            }
            return mockSocket;
        }),
        emit: jest.fn((_event: string, _payload: unknown, callback?: (response: { ok: boolean; error?: string }) => void) => {
            if (callback) callback({ ok: true });
            return mockSocket;
        }),
        connect: jest.fn(() => {
            _connected = true;
            mockSocket.connected = true;
            const handlers = listeners['connect'] ?? [];
            for (const h of handlers) h();
            return mockSocket;
        }),
        disconnect: jest.fn(() => {
            _connected = false;
            mockSocket.connected = false;
            return mockSocket;
        }),
        removeAllListeners: jest.fn(() => {
            Object.keys(listeners).forEach((key) => delete listeners[key]);
            return mockSocket;
        }),
        io: { engine: { on: jest.fn() } },
        __listeners: listeners,
        __simulateEvent: (event: string, ...args: unknown[]) => {
            const handlers = listeners[event] ?? [];
            for (const h of handlers) h(...args);
        },
    };

    return {
        io: jest.fn(() => mockSocket),
        __mockSocket: mockSocket,
    };
});

// ---------------------------------------------------------------------------
// expo-image-picker mock
// ---------------------------------------------------------------------------

jest.mock('expo-image-picker', () => ({
    launchImageLibraryAsync: jest.fn().mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///mock/image.jpg', width: 100, height: 100 }],
    }),
    launchCameraAsync: jest.fn().mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///mock/camera.jpg', width: 100, height: 100 }],
    }),
    requestCameraPermissionsAsync: jest
        .fn()
        .mockResolvedValue({ status: 'granted' }),
    MediaTypeOptions: {
        Images: 'Images',
        Videos: 'Videos',
        All: 'All',
    },
}));

// ---------------------------------------------------------------------------
// expo-clipboard mock
// ---------------------------------------------------------------------------

jest.mock('expo-clipboard', () => ({
    setStringAsync: jest.fn().mockResolvedValue(true),
    getStringAsync: jest.fn().mockResolvedValue(''),
    hasStringAsync: jest.fn().mockResolvedValue(false),
}));

// ---------------------------------------------------------------------------
// expo-document-picker mock
// ---------------------------------------------------------------------------

jest.mock('expo-document-picker', () => ({
    getDocumentAsync: jest.fn().mockResolvedValue({
        canceled: false,
        assets: [{
            uri: 'file:///mock/document.pdf',
            name: 'document.pdf',
            mimeType: 'application/pdf',
            size: 1024,
        }],
    }),
}));

