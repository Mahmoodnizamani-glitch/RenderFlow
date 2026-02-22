/**
 * Shared test factories for RenderFlow.
 *
 * Provides deterministic factory functions for all major entity types.
 * Reusable across mobile, API, and worker test suites.
 */
import type { UserResponse, Project, RenderJob, Asset } from '../schemas';

// ---------------------------------------------------------------------------
// Deterministic IDs
// ---------------------------------------------------------------------------

const DEFAULT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const DEFAULT_PROJECT_UUID = '660e8400-e29b-41d4-a716-446655440001';
const DEFAULT_RENDER_UUID = '770e8400-e29b-41d4-a716-446655440002';
const DEFAULT_ASSET_UUID = '880e8400-e29b-41d4-a716-446655440003';

const DEFAULT_TIMESTAMP = '2026-01-15T12:00:00.000Z';

// ---------------------------------------------------------------------------
// User Factory
// ---------------------------------------------------------------------------

export function createMockUser(overrides?: Partial<UserResponse>): UserResponse {
    return {
        id: DEFAULT_UUID,
        email: 'testuser@example.com',
        displayName: 'Test User',
        avatarUrl: null,
        tier: 'free',
        renderCredits: 5,
        createdAt: DEFAULT_TIMESTAMP,
        updatedAt: DEFAULT_TIMESTAMP,
        lastLoginAt: null,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Project Factory
// ---------------------------------------------------------------------------

export function createMockProject(overrides?: Partial<Project>): Project {
    return {
        id: DEFAULT_PROJECT_UUID,
        name: 'Test Project',
        description: 'A test project for unit tests',
        code: 'export default () => <div>Hello</div>;',
        thumbnailUri: null,
        compositionWidth: 1920,
        compositionHeight: 1080,
        fps: 30,
        durationInFrames: 150,
        variables: {},
        isFavorite: false,
        syncStatus: 'local',
        remoteId: null,
        createdAt: DEFAULT_TIMESTAMP,
        updatedAt: DEFAULT_TIMESTAMP,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// RenderJob Factory
// ---------------------------------------------------------------------------

export function createMockRenderJob(overrides?: Partial<RenderJob>): RenderJob {
    return {
        id: DEFAULT_RENDER_UUID,
        projectId: DEFAULT_PROJECT_UUID,
        status: 'queued',
        renderType: 'cloud',
        format: 'mp4',
        quality: 80,
        resolution: '1920x1080',
        fps: 30,
        progress: 0,
        currentFrame: 0,
        totalFrames: 150,
        outputUri: null,
        remoteJobId: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: DEFAULT_TIMESTAMP,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Asset Factory
// ---------------------------------------------------------------------------

export function createMockAsset(overrides?: Partial<Asset>): Asset {
    return {
        id: DEFAULT_ASSET_UUID,
        projectId: DEFAULT_PROJECT_UUID,
        name: 'test-image.png',
        type: 'image',
        mimeType: 'image/png',
        fileSize: 102400,
        localUri: null,
        remoteUrl: null,
        createdAt: DEFAULT_TIMESTAMP,
        ...overrides,
    };
}
