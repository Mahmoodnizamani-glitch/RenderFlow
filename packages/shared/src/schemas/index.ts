export {
    // Enums
    SyncStatusEnum,
    AssetTypeEnum,
    RenderJobStatusEnum,
    RenderTypeEnum,
    // Project
    ProjectSchema,
    CreateProjectInputSchema,
    UpdateProjectInputSchema,
    // Asset
    AssetSchema,
    CreateAssetInputSchema,
    // Render Job
    RenderJobSchema,
    CreateRenderJobInputSchema,
} from './project';

export type {
    // Enum types
    SyncStatus,
    AssetType,
    RenderJobStatus,
    RenderType,
    // Project types
    Project,
    CreateProjectInput,
    UpdateProjectInput,
    // Asset types
    Asset,
    CreateAssetInput,
    // Render Job types
    RenderJob,
    CreateRenderJobInput,
} from './project';

// -- Auth schemas & types -----------------------------------------------------

export {
    UserTierEnum,
    UserResponseSchema,
    RegisterInputSchema,
    LoginInputSchema,
    RefreshTokenInputSchema,
    ChangePasswordInputSchema,
    AuthResponseSchema,
    MessageResponseSchema,
} from './auth';

export type {
    UserTier,
    UserResponse,
    RegisterInput,
    LoginInput,
    RefreshTokenInput,
    ChangePasswordInput,
    AuthResponse,
    MessageResponse,
} from './auth';

// -- getInput schemas & types -------------------------------------------------

export {
    InputTypeSchema,
    InputOptionsSchema,
    VariableDefinitionSchema,
} from '../getInput';

export type {
    InputType,
    InputOptions,
    VariableDefinition,
    VariableValues,
    GetInputFn,
} from '../getInput';
