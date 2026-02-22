/**
 * Tests for AppError class.
 */
import { describe, it, expect } from 'vitest';
import { AppError, ERROR_CODES } from '../errors.js';

describe('AppError', () => {
    // -----------------------------------------------------------------------
    // Constructor / basic behaviour
    // -----------------------------------------------------------------------

    it('creates an error with correct code and status', () => {
        const err = new AppError('NOT_FOUND', 'User not found');
        expect(err.code).toBe('NOT_FOUND');
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe('User not found');
        expect(err.name).toBe('AppError');
    });

    it('includes details when provided', () => {
        const details = { field: 'email', reason: 'already exists' };
        const err = new AppError('CONFLICT', 'Email taken', details);
        expect(err.details).toEqual(details);
    });

    it('is an instance of Error', () => {
        const err = new AppError('INTERNAL', 'Something broke');
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(AppError);
    });

    // -----------------------------------------------------------------------
    // toJSON
    // -----------------------------------------------------------------------

    it('serialises to the standard error envelope without details', () => {
        const err = new AppError('UNAUTHORIZED', 'Bad token');
        expect(err.toJSON()).toEqual({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Bad token',
            },
        });
    });

    it('serialises to the standard error envelope with details', () => {
        const details = [{ path: 'name', message: 'Required' }];
        const err = new AppError('VALIDATION_ERROR', 'Invalid input', details);
        expect(err.toJSON()).toEqual({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid input',
                details,
            },
        });
    });

    // -----------------------------------------------------------------------
    // Factory methods
    // -----------------------------------------------------------------------

    it('validation() creates 400', () => {
        const err = AppError.validation('Bad input');
        expect(err.code).toBe('VALIDATION_ERROR');
        expect(err.statusCode).toBe(400);
    });

    it('unauthorized() creates 401 with default message', () => {
        const err = AppError.unauthorized();
        expect(err.code).toBe('UNAUTHORIZED');
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Unauthorized');
    });

    it('forbidden() creates 403', () => {
        const err = AppError.forbidden();
        expect(err.code).toBe('FORBIDDEN');
        expect(err.statusCode).toBe(403);
    });

    it('notFound() creates 404 with default message', () => {
        const err = AppError.notFound();
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe('Resource not found');
    });

    it('notFound() accepts custom message', () => {
        const err = AppError.notFound('Project not found');
        expect(err.message).toBe('Project not found');
    });

    it('conflict() creates 409', () => {
        const err = AppError.conflict('Email already registered');
        expect(err.code).toBe('CONFLICT');
        expect(err.statusCode).toBe(409);
    });

    it('rateLimited() creates 429', () => {
        const err = AppError.rateLimited();
        expect(err.code).toBe('RATE_LIMITED');
        expect(err.statusCode).toBe(429);
    });

    it('internal() creates 500', () => {
        const err = AppError.internal();
        expect(err.code).toBe('INTERNAL');
        expect(err.statusCode).toBe(500);
    });

    // -----------------------------------------------------------------------
    // Type guard
    // -----------------------------------------------------------------------

    it('is() returns true for AppError instances', () => {
        expect(AppError.is(new AppError('INTERNAL', 'oops'))).toBe(true);
    });

    it('is() returns false for plain Error', () => {
        expect(AppError.is(new Error('oops'))).toBe(false);
    });

    it('is() returns false for null', () => {
        expect(AppError.is(null)).toBe(false);
    });

    it('is() returns false for undefined', () => {
        expect(AppError.is(undefined)).toBe(false);
    });

    // -----------------------------------------------------------------------
    // ERROR_CODES constant
    // -----------------------------------------------------------------------

    it('maps all codes to correct HTTP statuses', () => {
        expect(ERROR_CODES.VALIDATION_ERROR).toBe(400);
        expect(ERROR_CODES.UNAUTHORIZED).toBe(401);
        expect(ERROR_CODES.FORBIDDEN).toBe(403);
        expect(ERROR_CODES.NOT_FOUND).toBe(404);
        expect(ERROR_CODES.CONFLICT).toBe(409);
        expect(ERROR_CODES.RATE_LIMITED).toBe(429);
        expect(ERROR_CODES.INTERNAL).toBe(500);
    });
});
