/**
 * Application error codes used across the mobile app.
 */
export const ErrorCode = {
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    DUPLICATE_ERROR: 'DUPLICATE_ERROR',
    STORAGE_ERROR: 'STORAGE_ERROR',
    MIGRATION_ERROR: 'MIGRATION_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Custom error class for typed, structured error handling.
 *
 * Always use the static factory methods instead of `new AppError(...)` directly.
 */
export class AppError extends Error {
    readonly code: ErrorCode;
    override readonly cause: Error | undefined;

    constructor(code: ErrorCode, message: string, cause?: Error) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.cause = cause;
    }

    // -- Factory methods ------------------------------------------------------

    static notFound(entity: string, id?: string): AppError {
        const detail = id ? ` with id "${id}"` : '';
        return new AppError(ErrorCode.NOT_FOUND, `${entity} not found${detail}`);
    }

    static validation(message: string, cause?: Error): AppError {
        return new AppError(ErrorCode.VALIDATION_ERROR, message, cause);
    }

    static database(message: string, cause?: Error): AppError {
        return new AppError(ErrorCode.DATABASE_ERROR, message, cause);
    }

    static duplicate(entity: string, field: string, value: string): AppError {
        return new AppError(
            ErrorCode.DUPLICATE_ERROR,
            `${entity} with ${field} "${value}" already exists`,
        );
    }

    static storage(message: string, cause?: Error): AppError {
        return new AppError(ErrorCode.STORAGE_ERROR, message, cause);
    }

    static migration(message: string, cause?: Error): AppError {
        return new AppError(ErrorCode.MIGRATION_ERROR, message, cause);
    }

    static unknown(message: string, cause?: Error): AppError {
        return new AppError(ErrorCode.UNKNOWN_ERROR, message, cause);
    }

    /**
     * Type-guard to check if an unknown value is an AppError.
     */
    static is(value: unknown): value is AppError {
        return value instanceof AppError;
    }
}
