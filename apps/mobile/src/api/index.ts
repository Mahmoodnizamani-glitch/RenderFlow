/**
 * API module barrel export.
 */
export { apiClient, onTokenCleared } from './client';
export { API_BASE_URL } from './client';
export { ApiError, extractApiError } from './errors';
export {
    setTokens,
    getAccessToken,
    getRefreshToken,
    clearTokens,
} from './secureStorage';
export {
    register,
    login,
    refreshToken,
    logout,
    changePassword,
    getMe,
} from './auth';

// Project API
export {
    fetchProjects,
    fetchProject,
    createRemoteProject,
    updateRemoteProject,
    deleteRemoteProject,
    serverToLocal,
    localToServerCreate,
    localToServerUpdate,
} from './projects';
export type { ServerProject, ProjectListResponse } from './projects';

// TanStack Query hooks
export {
    projectKeys,
    useRemoteProjects,
    useRemoteProject,
    useCreateRemoteProject,
    useUpdateRemoteProject,
    useDeleteRemoteProject,
} from './useProjectQueries';

// Render API
export {
    submitRender,
    getRenders,
    getRenderStatus,
    cancelRender,
    getDownloadUrl,
    serverRenderToLocal,
} from './renders';
export type {
    ServerRenderJob,
    SubmitRenderInput,
    RenderListFilters,
    DownloadUrlResponse,
} from './renders';

// Asset API
export {
    getPresignedUploadUrl,
    uploadToPresignedUrl,
    uploadAsset,
    fetchProjectAssets,
    deleteRemoteAsset,
    serverAssetToLocal,
} from './assets';
export type { ServerAsset, UploadProgressCallback } from './assets';

// WebSocket
export {
    connect as wsConnect,
    disconnect as wsDisconnect,
    isConnected as wsIsConnected,
    updateAuth as wsUpdateAuth,
    subscribeToJob,
    unsubscribeFromJob,
    getSubscribedJobs,
    onRenderStarted,
    onRenderProgress,
    onRenderCompleted,
    onRenderFailed,
    onRenderCancelled,
    onCreditsUpdated,
} from './socket';
export type {
    RenderStartedPayload,
    RenderProgressPayload,
    RenderCompletedPayload,
    RenderFailedPayload,
    RenderCancelledPayload,
    CreditsUpdatedPayload,
} from './socket';
