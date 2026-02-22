/**
 * Application error class with typed error codes.
 *
 * Maps error codes to HTTP status codes and provides a consistent
 * JSON serialisation format for all API error responses:
 *
 *   { error: { code: string, message: string, details?: unknown } }
 */

// ---------------------------------------------------------------------------
// Error codes → HTTP status mapping
// ---------------------------------------------------------------------------

export const ERROR_CODES = {
    VALIDATION_ERROR: 400,
    UNAUTHORIZED: 401,
    PAYMENT_REQUIRED: 402,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    RATE_LIMITED: 429,
    INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

// ---------------------------------------------------------------------------
// AppError class
// ---------------------------------------------------------------------------

export class AppError extends Error {
    public readonly code: ErrorCode;
    public readonly statusCode: number;
    public readonly details?: unknown;

    constructor(code: ErrorCode, message: string, details?: unknown) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.statusCode = ERROR_CODES[code];
        this.details = details;
    }

    /**
     * Serialise to the standard API error envelope.
     */
    toJSON(): { error: { code: string; message: string; details?: unknown } } {
        const payload: { code: string; message: string; details?: unknown } = {
            code: this.code,
            message: this.message,
        };

        if (this.details !== undefined) {
            payload.details = this.details;
        }

        return { error: payload };
    }

    // -----------------------------------------------------------------------
    // Factory methods
    // -----------------------------------------------------------------------

    static validation(message: string, details?: unknown): AppError {
        return new AppError('VALIDATION_ERROR', message, details);
    }

    static unauthorized(message = 'Unauthorized'): AppError {
        return new AppError('UNAUTHORIZED', message);
    }

    static forbidden(message = 'Forbidden'): AppError {
        return new AppError('FORBIDDEN', message);
    }

    static notFound(message = 'Resource not found'): AppError {
        return new AppError('NOT_FOUND', message);
    }

    static conflict(message: string, details?: unknown): AppError {
        return new AppError('CONFLICT', message, details);
    }

    static paymentRequired(message = 'Insufficient credits'): AppError {
        return new AppError('PAYMENT_REQUIRED', message);
    }

    static rateLimited(message = 'Too many requests'): AppError {
        return new AppError('RATE_LIMITED', message);
    }

    static internal(message = 'Internal server error'): AppError {
        return new AppError('INTERNAL', message);
    }

    /**
     * Type guard: check whether an unknown value is an `AppError`.
     */
    static is(value: unknown): value is AppError {
        return value instanceof AppError;
    }
}
