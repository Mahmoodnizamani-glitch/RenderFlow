/**
 * Realistic mock data to use as a fallback when the backend API is unreachable.
 * This prevents the UI from showing empty lists or "0" hardcoded values.
 */
import type { ServerAsset } from './assets';
import type { UsageSummaryResponse } from './subscription';

export const mockUsageSummary: UsageSummaryResponse = {
    usage: {
        creditBalance: 1250,
        storageUsedBytes: 1024 * 1024 * 512, // 512 MB
        storageLimitBytes: 1024 * 1024 * 1024 * 5, // 5 GB
        rendersToday: 3,
        maxRendersPerDay: 50,
        tier: 'pro',
    },
    subscription: {
        id: 'sub_mock_123',
        userId: 'user_mock_123',
        tier: 'pro',
        status: 'active',
        provider: 'stripe',
        currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        trialEnd: null,
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    },
};

export const mockAssets: ServerAsset[] = [
    {
        id: 'asset_mock_1',
        userId: 'user_mock_123',
        projectId: null,
        name: 'intro_logo.png',
        type: 'image',
        mimeType: 'image/png',
        fileSize: 1024 * 1024 * 2.5, // 2.5MB
        storagePath: 'assets/user_mock_123/intro_logo.png',
        cdnUrl: 'https://picsum.photos/seed/renderflow1/800/600',
        metadata: {},
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'asset_mock_2',
        userId: 'user_mock_123',
        projectId: null,
        name: 'background_music.mp3',
        type: 'audio',
        mimeType: 'audio/mpeg',
        fileSize: 1024 * 1024 * 5.2, // 5.2MB
        storagePath: 'assets/user_mock_123/background_music.mp3',
        cdnUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        metadata: {},
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'asset_mock_3',
        userId: 'user_mock_123',
        projectId: null,
        name: 'b-roll_city.mp4',
        type: 'video',
        mimeType: 'video/mp4',
        fileSize: 1024 * 1024 * 45.8, // 45.8MB
        storagePath: 'assets/user_mock_123/b-roll_city.mp4',
        cdnUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        metadata: {},
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
];
