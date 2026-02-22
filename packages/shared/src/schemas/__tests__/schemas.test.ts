/**
 * Zod schema validation tests for auth, project, asset, and render job schemas.
 *
 * Tests valid inputs, invalid inputs, defaults, edge cases, and type coercion.
 */
import {
    // Auth
    UserTierEnum,
    UserResponseSchema,
    RegisterInputSchema,
    LoginInputSchema,
    RefreshTokenInputSchema,
    ChangePasswordInputSchema,
    AuthResponseSchema,
    MessageResponseSchema,
    // Project
    SyncStatusEnum,
    AssetTypeEnum,
    RenderJobStatusEnum,
    RenderTypeEnum,
    ProjectSchema,
    CreateProjectInputSchema,
    UpdateProjectInputSchema,
    // Asset
    AssetSchema,
    CreateAssetInputSchema,
    // Render Job
    RenderJobSchema,
    CreateRenderJobInputSchema,
} from '../../schemas';
import { createMockUser, createMockProject, createMockRenderJob, createMockAsset } from '../../__tests__/factories';

// ===========================================================================
// Auth Schemas
// ===========================================================================

describe('UserTierEnum', () => {
    it('accepts all valid tiers', () => {
        for (const tier of ['free', 'pro', 'team', 'enterprise']) {
            expect(UserTierEnum.parse(tier)).toBe(tier);
        }
    });

    it('rejects invalid tier', () => {
        expect(() => UserTierEnum.parse('premium')).toThrow();
        expect(() => UserTierEnum.parse('')).toThrow();
        expect(() => UserTierEnum.parse(123)).toThrow();
    });
});

describe('RegisterInputSchema', () => {
    it('accepts valid registration input', () => {
        const input = {
            email: 'User@Example.COM',
            password: 'password123',
            displayName: 'Test User',
        };
        const result = RegisterInputSchema.parse(input);
        expect(result.email).toBe('user@example.com');
        expect(result.password).toBe('password123');
        expect(result.displayName).toBe('Test User');
    });

    it('normalizes email to lowercase and trims', () => {
        const result = RegisterInputSchema.parse({
            email: 'USER@Test.COM',
            password: 'password123',
            displayName: 'User',
        });
        expect(result.email).toBe('user@test.com');
    });

    it('trims displayName', () => {
        const result = RegisterInputSchema.parse({
            email: 'a@b.com',
            password: 'password123',
            displayName: '  Trimmed Name  ',
        });
        expect(result.displayName).toBe('Trimmed Name');
    });

    it('rejects invalid email', () => {
        expect(() =>
            RegisterInputSchema.parse({
                email: 'not-an-email',
                password: 'password123',
                displayName: 'User',
            }),
        ).toThrow(/email/i);
    });

    it('rejects password shorter than 8 characters', () => {
        expect(() =>
            RegisterInputSchema.parse({
                email: 'a@b.com',
                password: 'short',
                displayName: 'User',
            }),
        ).toThrow(/8 characters/i);
    });

    it('rejects empty displayName', () => {
        expect(() =>
            RegisterInputSchema.parse({
                email: 'a@b.com',
                password: 'password123',
                displayName: '',
            }),
        ).toThrow();
    });

    it('rejects displayName exceeding 255 characters', () => {
        expect(() =>
            RegisterInputSchema.parse({
                email: 'a@b.com',
                password: 'password123',
                displayName: 'A'.repeat(256),
            }),
        ).toThrow();
    });

    it('rejects missing required fields', () => {
        expect(() => RegisterInputSchema.parse({})).toThrow();
        expect(() => RegisterInputSchema.parse({ email: 'a@b.com' })).toThrow();
    });
});

describe('LoginInputSchema', () => {
    it('accepts valid login input', () => {
        const result = LoginInputSchema.parse({
            email: 'user@example.com',
            password: 'password123',
        });
        expect(result.email).toBe('user@example.com');
        expect(result.password).toBe('password123');
    });

    it('normalizes email to lowercase', () => {
        const result = LoginInputSchema.parse({
            email: 'USER@EXAMPLE.COM',
            password: 'pass',
        });
        expect(result.email).toBe('user@example.com');
    });

    it('rejects empty password', () => {
        expect(() =>
            LoginInputSchema.parse({
                email: 'a@b.com',
                password: '',
            }),
        ).toThrow(/required/i);
    });

    it('rejects invalid email', () => {
        expect(() =>
            LoginInputSchema.parse({
                email: 'invalid',
                password: 'password123',
            }),
        ).toThrow();
    });
});

describe('RefreshTokenInputSchema', () => {
    it('accepts valid refresh token', () => {
        const result = RefreshTokenInputSchema.parse({
            refreshToken: 'some-long-refresh-token',
        });
        expect(result.refreshToken).toBe('some-long-refresh-token');
    });

    it('rejects empty refresh token', () => {
        expect(() =>
            RefreshTokenInputSchema.parse({ refreshToken: '' }),
        ).toThrow(/required/i);
    });

    it('rejects missing refresh token', () => {
        expect(() => RefreshTokenInputSchema.parse({})).toThrow();
    });
});

describe('ChangePasswordInputSchema', () => {
    it('accepts valid password change', () => {
        const result = ChangePasswordInputSchema.parse({
            oldPassword: 'currentpass',
            newPassword: 'newpassword123',
        });
        expect(result.oldPassword).toBe('currentpass');
        expect(result.newPassword).toBe('newpassword123');
    });

    it('rejects empty old password', () => {
        expect(() =>
            ChangePasswordInputSchema.parse({
                oldPassword: '',
                newPassword: 'newpassword123',
            }),
        ).toThrow(/required/i);
    });

    it('rejects new password shorter than 8 characters', () => {
        expect(() =>
            ChangePasswordInputSchema.parse({
                oldPassword: 'currentpass',
                newPassword: 'short',
            }),
        ).toThrow(/8 characters/i);
    });
});

describe('UserResponseSchema', () => {
    it('accepts valid user response from factory', () => {
        const user = createMockUser();
        const result = UserResponseSchema.parse(user);
        expect(result.id).toBe(user.id);
        expect(result.email).toBe(user.email);
    });

    it('rejects non-uuid id', () => {
        const user = createMockUser({ id: 'not-a-uuid' });
        expect(() => UserResponseSchema.parse(user)).toThrow();
    });

    it('rejects negative renderCredits', () => {
        const user = createMockUser({ renderCredits: -1 });
        expect(() => UserResponseSchema.parse(user)).toThrow();
    });

    it('allows nullable fields to be null', () => {
        const user = createMockUser({
            displayName: null,
            avatarUrl: null,
            lastLoginAt: null,
        });
        const result = UserResponseSchema.parse(user);
        expect(result.displayName).toBeNull();
        expect(result.avatarUrl).toBeNull();
        expect(result.lastLoginAt).toBeNull();
    });
});

describe('AuthResponseSchema', () => {
    it('accepts valid auth response', () => {
        const user = createMockUser();
        const result = AuthResponseSchema.parse({
            user,
            accessToken: 'access-token-value',
            refreshToken: 'refresh-token-value',
        });
        expect(result.accessToken).toBe('access-token-value');
        expect(result.refreshToken).toBe('refresh-token-value');
    });

    it('rejects missing tokens', () => {
        const user = createMockUser();
        expect(() => AuthResponseSchema.parse({ user })).toThrow();
    });
});

describe('MessageResponseSchema', () => {
    it('accepts valid message', () => {
        const result = MessageResponseSchema.parse({ message: 'Success' });
        expect(result.message).toBe('Success');
    });

    it('rejects missing message', () => {
        expect(() => MessageResponseSchema.parse({})).toThrow();
    });
});

// ===========================================================================
// Project / Asset / RenderJob Schemas
// ===========================================================================

describe('Enum schemas', () => {
    it('SyncStatusEnum accepts valid values', () => {
        for (const v of ['local', 'syncing', 'synced', 'conflict']) {
            expect(SyncStatusEnum.parse(v)).toBe(v);
        }
    });

    it('AssetTypeEnum accepts valid values', () => {
        for (const v of ['image', 'video', 'audio', 'font']) {
            expect(AssetTypeEnum.parse(v)).toBe(v);
        }
    });

    it('RenderJobStatusEnum accepts valid values', () => {
        for (const v of ['queued', 'processing', 'encoding', 'completed', 'failed']) {
            expect(RenderJobStatusEnum.parse(v)).toBe(v);
        }
    });

    it('RenderTypeEnum accepts valid values', () => {
        for (const v of ['local', 'cloud']) {
            expect(RenderTypeEnum.parse(v)).toBe(v);
        }
    });

    it('all enums reject invalid values', () => {
        expect(() => SyncStatusEnum.parse('invalid')).toThrow();
        expect(() => AssetTypeEnum.parse('document')).toThrow();
        expect(() => RenderJobStatusEnum.parse('running')).toThrow();
        expect(() => RenderTypeEnum.parse('hybrid')).toThrow();
    });
});

describe('ProjectSchema', () => {
    it('accepts valid project from factory', () => {
        const project = createMockProject();
        const result = ProjectSchema.parse(project);
        expect(result.id).toBe(project.id);
        expect(result.name).toBe(project.name);
    });

    it('applies defaults for optional fields', () => {
        const result = ProjectSchema.parse({
            id: '660e8400-e29b-41d4-a716-446655440001',
            name: 'Minimal',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        });
        expect(result.description).toBe('');
        expect(result.code).toBe('');
        expect(result.compositionWidth).toBe(1920);
        expect(result.compositionHeight).toBe(1080);
        expect(result.fps).toBe(30);
        expect(result.durationInFrames).toBe(150);
        expect(result.variables).toEqual({});
        expect(result.isFavorite).toBe(false);
        expect(result.syncStatus).toBe('local');
        expect(result.remoteId).toBeNull();
    });

    it('rejects empty name', () => {
        const project = createMockProject({ name: '' });
        expect(() => ProjectSchema.parse(project)).toThrow();
    });

    it('rejects name exceeding 255 characters', () => {
        const project = createMockProject({ name: 'A'.repeat(256) });
        expect(() => ProjectSchema.parse(project)).toThrow();
    });

    it('rejects negative fps', () => {
        const project = createMockProject({ fps: -1 });
        expect(() => ProjectSchema.parse(project)).toThrow();
    });

    it('rejects fps above 120', () => {
        const project = createMockProject({ fps: 121 });
        expect(() => ProjectSchema.parse(project)).toThrow();
    });

    it('rejects non-positive compositionWidth', () => {
        const project = createMockProject({ compositionWidth: 0 });
        expect(() => ProjectSchema.parse(project)).toThrow();
    });
});

describe('CreateProjectInputSchema', () => {
    it('accepts valid input with only name', () => {
        const result = CreateProjectInputSchema.parse({ name: 'New Project' });
        expect(result.name).toBe('New Project');
    });

    it('accepts full input', () => {
        const result = CreateProjectInputSchema.parse({
            name: 'Full Project',
            description: 'A full project',
            code: 'export default () => null;',
            compositionWidth: 1280,
            compositionHeight: 720,
            fps: 60,
            durationInFrames: 300,
        });
        expect(result.fps).toBe(60);
    });

    it('rejects missing name', () => {
        expect(() => CreateProjectInputSchema.parse({})).toThrow();
    });
});

describe('UpdateProjectInputSchema', () => {
    it('accepts partial updates', () => {
        const result = UpdateProjectInputSchema.parse({ name: 'Updated Name' });
        expect(result.name).toBe('Updated Name');
    });

    it('accepts empty update (no fields)', () => {
        const result = UpdateProjectInputSchema.parse({});
        expect(result).toEqual({});
    });

    it('accepts isFavorite toggle', () => {
        const result = UpdateProjectInputSchema.parse({ isFavorite: true });
        expect(result.isFavorite).toBe(true);
    });
});

describe('AssetSchema', () => {
    it('accepts valid asset from factory', () => {
        const asset = createMockAsset();
        const result = AssetSchema.parse(asset);
        expect(result.id).toBe(asset.id);
        expect(result.type).toBe('image');
    });

    it('rejects invalid asset type', () => {
        const asset = createMockAsset({ type: 'document' as never });
        expect(() => AssetSchema.parse(asset)).toThrow();
    });

    it('rejects negative fileSize', () => {
        const asset = createMockAsset({ fileSize: -100 });
        expect(() => AssetSchema.parse(asset)).toThrow();
    });

    it('rejects empty name', () => {
        const asset = createMockAsset({ name: '' });
        expect(() => AssetSchema.parse(asset)).toThrow();
    });
});

describe('CreateAssetInputSchema', () => {
    it('accepts valid asset creation input', () => {
        const result = CreateAssetInputSchema.parse({
            projectId: '660e8400-e29b-41d4-a716-446655440001',
            name: 'new-asset.png',
            type: 'image',
            mimeType: 'image/png',
            fileSize: 2048,
        });
        expect(result.name).toBe('new-asset.png');
    });

    it('rejects missing required fields', () => {
        expect(() => CreateAssetInputSchema.parse({ name: 'test.png' })).toThrow();
    });
});

describe('RenderJobSchema', () => {
    it('accepts valid render job from factory', () => {
        const job = createMockRenderJob();
        const result = RenderJobSchema.parse(job);
        expect(result.id).toBe(job.id);
        expect(result.status).toBe('queued');
    });

    it('applies defaults for optional fields', () => {
        const result = RenderJobSchema.parse({
            id: '770e8400-e29b-41d4-a716-446655440002',
            projectId: '660e8400-e29b-41d4-a716-446655440001',
            createdAt: '2026-01-01T00:00:00.000Z',
        });
        expect(result.status).toBe('queued');
        expect(result.renderType).toBe('cloud');
        expect(result.format).toBe('mp4');
        expect(result.quality).toBe(80);
        expect(result.progress).toBe(0);
    });

    it('rejects quality below 1', () => {
        const job = createMockRenderJob({ quality: 0 });
        expect(() => RenderJobSchema.parse(job)).toThrow();
    });

    it('rejects quality above 100', () => {
        const job = createMockRenderJob({ quality: 101 });
        expect(() => RenderJobSchema.parse(job)).toThrow();
    });

    it('rejects progress below 0', () => {
        const job = createMockRenderJob({ progress: -1 });
        expect(() => RenderJobSchema.parse(job)).toThrow();
    });

    it('rejects progress above 100', () => {
        const job = createMockRenderJob({ progress: 101 });
        expect(() => RenderJobSchema.parse(job)).toThrow();
    });

    it('rejects invalid status', () => {
        const job = createMockRenderJob({ status: 'running' as never });
        expect(() => RenderJobSchema.parse(job)).toThrow();
    });
});

describe('CreateRenderJobInputSchema', () => {
    it('accepts valid input with only projectId', () => {
        const result = CreateRenderJobInputSchema.parse({
            projectId: '660e8400-e29b-41d4-a716-446655440001',
        });
        expect(result.projectId).toBe('660e8400-e29b-41d4-a716-446655440001');
    });

    it('accepts full input with all optional fields', () => {
        const result = CreateRenderJobInputSchema.parse({
            projectId: '660e8400-e29b-41d4-a716-446655440001',
            renderType: 'local',
            format: 'webm',
            quality: 90,
            resolution: '1280x720',
            fps: 60,
            totalFrames: 300,
        });
        expect(result.format).toBe('webm');
        expect(result.quality).toBe(90);
    });

    it('rejects missing projectId', () => {
        expect(() => CreateRenderJobInputSchema.parse({})).toThrow();
    });
});
