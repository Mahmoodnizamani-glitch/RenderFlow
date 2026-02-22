/**
 * Tests for the API client interceptors and error handling.
 */
import axios from 'axios';

import { ApiError, extractApiError } from '../errors';

describe('ApiError', () => {
    it('maps 401 invalid credentials to user-friendly message', () => {
        const err = new ApiError(401, 'Invalid credentials');
        expect(err.message).toBe('Incorrect email or password. Please try again.');
        expect(err.statusCode).toBe(401);
        expect(err.isNetwork).toBe(false);
    });

    it('maps 401 expired to session expired message', () => {
        const err = new ApiError(401, 'Token expired');
        expect(err.message).toContain('session has expired');
    });

    it('maps 409 email already exists', () => {
        const err = new ApiError(409, 'Email already exists');
        expect(err.message).toContain('already exists');
    });

    it('maps 422 email validation error', () => {
        const err = new ApiError(422, 'Invalid email format');
        expect(err.message).toContain('valid email');
    });

    it('maps 422 password validation error', () => {
        const err = new ApiError(422, 'Password too short');
        expect(err.message).toContain('Password');
    });

    it('maps 429 rate limit', () => {
        const err = new ApiError(429, 'Too many requests');
        expect(err.message).toContain('Too many requests');
    });

    it('maps 500+ to server error message', () => {
        const err = new ApiError(500, 'Internal server error');
        expect(err.message).toContain('Something went wrong');
    });

    it('maps network error', () => {
        const err = new ApiError(0, 'Network error', true);
        expect(err.isNetwork).toBe(true);
    });
});

describe('extractApiError', () => {
    it('returns same instance if already ApiError', () => {
        const original = new ApiError(401, 'test');
        const extracted = extractApiError(original);
        expect(extracted).toBe(original);
    });

    it('extracts from axios error with response', () => {
        const axiosError = new axios.AxiosError(
            'Request failed',
            '401',
            undefined,
            undefined,
            {
                status: 401,
                data: { message: 'Invalid credentials' },
                statusText: 'Unauthorized',
                headers: {},
                config: {} as never,
            },
        );

        const extracted = extractApiError(axiosError);
        expect(extracted.statusCode).toBe(401);
        expect(extracted.message).toBe('Incorrect email or password. Please try again.');
    });

    it('extracts network error from axios error without response', () => {
        const axiosError = new axios.AxiosError(
            'Network Error',
            'ERR_NETWORK',
        );

        const extracted = extractApiError(axiosError);
        expect(extracted.isNetwork).toBe(true);
        expect(extracted.statusCode).toBe(0);
    });

    it('wraps generic Error', () => {
        const error = new Error('something broke');
        const extracted = extractApiError(error);
        expect(extracted.isNetwork).toBe(true);
    });

    it('wraps non-Error values', () => {
        const extracted = extractApiError('a string');
        expect(extracted.isNetwork).toBe(true);
    });
});
