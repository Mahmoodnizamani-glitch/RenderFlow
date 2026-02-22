/**
 * Render error classification.
 *
 * Provides typed error categories with retry policies and
 * user-friendly error messages. The worker uses the error type
 * to decide whether to retry or fail immediately.
 */

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type RenderErrorType =
    | 'CODE_ERROR'
    | 'BUNDLE_ERROR'
    | 'RENDER_ERROR'
    | 'UPLOAD_ERROR'
    | 'TIMEOUT_ERROR';

// ---------------------------------------------------------------------------
// Retry policy per error type
// ---------------------------------------------------------------------------

export const ERROR_RETRY_POLICY: Record<RenderErrorType, { retryable: boolean; maxRetries: number }> = {
    CODE_ERROR: { retryable: false, maxRetries: 0 },
    BUNDLE_ERROR: { retryable: false, maxRetries: 0 },
    RENDER_ERROR: { retryable: true, maxRetries: 2 },
    UPLOAD_ERROR: { retryable: true, maxRetries: 3 },
    TIMEOUT_ERROR: { retryable: false, maxRetries: 0 },
};

// ---------------------------------------------------------------------------
// User-friendly message templates
// ---------------------------------------------------------------------------

const USER_MESSAGES: Record<RenderErrorType, string> = {
    CODE_ERROR: 'There is a syntax or runtime error in your project code.',
    BUNDLE_ERROR: 'Failed to bundle your project. Check your imports and module structure.',
    RENDER_ERROR: 'The video rendering process failed. This may be a temporary issue.',
    UPLOAD_ERROR: 'Failed to upload the rendered video. Please try again.',
    TIMEOUT_ERROR: 'Render timed out after 30 minutes. Try reducing the video duration or resolution.',
};

// ---------------------------------------------------------------------------
// RenderError class
// ---------------------------------------------------------------------------

export class RenderError extends Error {
    public readonly type: RenderErrorType;
    public readonly userMessage: string;
    public readonly retryable: boolean;
    public readonly maxRetries: number;
    public readonly cause?: Error;

    constructor(type: RenderErrorType, internalMessage: string, cause?: Error) {
        super(internalMessage);
        this.name = 'RenderError';
        this.type = type;
        this.userMessage = USER_MESSAGES[type];
        this.retryable = ERROR_RETRY_POLICY[type].retryable;
        this.maxRetries = ERROR_RETRY_POLICY[type].maxRetries;
        this.cause = cause;
    }

    /**
     * Build a user-facing error message combining the friendly template
     * with a sanitised excerpt of the internal error.
     */
    toUserString(): string {
        const sanitised = this.message
            .replace(/\/tmp\/[^\s]+/g, '<temp_path>')
            .replace(/at\s+\S+\s+\(\S+\)/g, '')
            .slice(0, 500);

        return `${this.userMessage}\n\nDetails: ${sanitised}`;
    }

    // -----------------------------------------------------------------------
    // Factory methods
    // -----------------------------------------------------------------------

    static code(message: string, cause?: Error): RenderError {
        return new RenderError('CODE_ERROR', message, cause);
    }

    static bundle(message: string, cause?: Error): RenderError {
        return new RenderError('BUNDLE_ERROR', message, cause);
    }

    static render(message: string, cause?: Error): RenderError {
        return new RenderError('RENDER_ERROR', message, cause);
    }

    static upload(message: string, cause?: Error): RenderError {
        return new RenderError('UPLOAD_ERROR', message, cause);
    }

    static timeout(message?: string): RenderError {
        return new RenderError('TIMEOUT_ERROR', message ?? 'Render exceeded 30 minute time limit');
    }

    // -----------------------------------------------------------------------
    // Classification helpers
    // -----------------------------------------------------------------------

    /**
     * Classify an unknown error thrown during a pipeline stage
     * into the appropriate RenderError type.
     */
    static classify(stage: string, error: unknown): RenderError {
        const errObj = error instanceof Error ? error : new Error(String(error));
        const msg = errObj.message;

        switch (stage) {
            case 'fetching':
            case 'preparing':
                return RenderError.code(msg, errObj);
            case 'bundling':
                return RenderError.bundle(msg, errObj);
            case 'rendering':
                return RenderError.render(msg, errObj);
            case 'uploading':
                return RenderError.upload(msg, errObj);
            default:
                return RenderError.render(msg, errObj);
        }
    }

    /**
     * Type guard: check whether an unknown value is a `RenderError`.
     */
    static is(value: unknown): value is RenderError {
        return value instanceof RenderError;
    }
}
