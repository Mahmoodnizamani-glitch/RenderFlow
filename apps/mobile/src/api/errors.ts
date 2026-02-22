/**
 * API error handling.
 *
 * Wraps Axios errors into a typed ApiError and provides user-friendly
 * message mapping. Raw server messages are never shown to users.
 */
import axios from 'axios';

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ApiError extends Error {
    readonly statusCode: number;
    readonly serverMessage: string;
    readonly isNetwork: boolean;

    constructor(statusCode: number, serverMessage: string, isNetwork = false) {
        super(mapToUserMessage(statusCode, serverMessage));
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.serverMessage = serverMessage;
        this.isNetwork = isNetwork;
    }
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Map API status codes and server messages to user-friendly text.
 * Never forwards raw server error strings to the UI.
 */
function mapToUserMessage(statusCode: number, serverMessage: string): string {
    const lower = serverMessage.toLowerCase();

    // Auth-specific mappings
    if (statusCode === 401) {
        if (lower.includes('invalid credentials') || lower.includes('invalid password')) {
            return 'Incorrect email or password. Please try again.';
        }
        if (lower.includes('expired')) {
            return 'Your session has expired. Please log in again.';
        }
        return 'Authentication failed. Please log in again.';
    }

    if (statusCode === 409) {
        if (lower.includes('email') && lower.includes('already')) {
            return 'An account with this email already exists.';
        }
        return 'This action conflicts with existing data.';
    }

    if (statusCode === 422 || statusCode === 400) {
        if (lower.includes('email')) return 'Please enter a valid email address.';
        if (lower.includes('password')) return 'Password does not meet requirements.';
        return 'Please check your input and try again.';
    }

    if (statusCode === 402) {
        return 'Insufficient credits. Please upgrade your plan.';
    }

    if (statusCode === 404) {
        return 'The requested resource was not found.';
    }

    if (statusCode === 429) {
        return 'Too many requests. Please wait a moment and try again.';
    }

    if (statusCode >= 500) {
        return 'Something went wrong on our end. Please try again later.';
    }

    if (statusCode === 0) {
        return 'Unable to connect to the server. Please check your internet connection.';
    }

    return 'An unexpected error occurred. Please try again.';
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/**
 * Extract an ApiError from an unknown thrown value.
 */
export function extractApiError(error: unknown): ApiError {
    if (error instanceof ApiError) {
        return error;
    }

    if (axios.isAxiosError(error)) {
        if (!error.response) {
            return new ApiError(
                0,
                'Network request failed',
                true,
            );
        }

        const status = error.response.status;
        const data = error.response.data as Record<string, unknown> | undefined;
        const message =
            (typeof data?.message === 'string' ? data.message : '') ||
            (typeof data?.error === 'string' ? data.error : '') ||
            error.message;

        return new ApiError(status, message);
    }

    if (error instanceof Error) {
        return new ApiError(0, error.message, true);
    }

    return new ApiError(0, 'An unexpected error occurred', true);
}
