/**
 * Unit tests for RenderError classification and retry policies.
 */
import { describe, it, expect } from 'vitest';
import { RenderError, ERROR_RETRY_POLICY } from '../errors.js';

describe('RenderError', () => {
    // -------------------------------------------------------------------
    // Factory methods
    // -------------------------------------------------------------------

    describe('factory methods', () => {
        it('creates CODE_ERROR with correct properties', () => {
            const err = RenderError.code('Syntax error in user code');

            expect(err.type).toBe('CODE_ERROR');
            expect(err.retryable).toBe(false);
            expect(err.maxRetries).toBe(0);
            expect(err.message).toBe('Syntax error in user code');
            expect(err.userMessage).toContain('syntax or runtime error');
            expect(err.name).toBe('RenderError');
        });

        it('creates BUNDLE_ERROR with correct properties', () => {
            const err = RenderError.bundle('Module not found: ./missing');

            expect(err.type).toBe('BUNDLE_ERROR');
            expect(err.retryable).toBe(false);
            expect(err.maxRetries).toBe(0);
            expect(err.userMessage).toContain('bundle');
        });

        it('creates RENDER_ERROR with correct properties', () => {
            const err = RenderError.render('Chromium crashed');

            expect(err.type).toBe('RENDER_ERROR');
            expect(err.retryable).toBe(true);
            expect(err.maxRetries).toBe(2);
            expect(err.userMessage).toContain('rendering process failed');
        });

        it('creates UPLOAD_ERROR with correct properties', () => {
            const err = RenderError.upload('S3 timeout');

            expect(err.type).toBe('UPLOAD_ERROR');
            expect(err.retryable).toBe(true);
            expect(err.maxRetries).toBe(3);
            expect(err.userMessage).toContain('upload');
        });

        it('creates TIMEOUT_ERROR with default message', () => {
            const err = RenderError.timeout();

            expect(err.type).toBe('TIMEOUT_ERROR');
            expect(err.retryable).toBe(false);
            expect(err.maxRetries).toBe(0);
            expect(err.message).toContain('30 minute');
        });

        it('creates TIMEOUT_ERROR with custom message', () => {
            const err = RenderError.timeout('Custom timeout message');

            expect(err.message).toBe('Custom timeout message');
        });

        it('preserves cause error', () => {
            const cause = new Error('Original error');
            const err = RenderError.code('Wrapped', cause);

            expect(err.cause).toBe(cause);
        });
    });

    // -------------------------------------------------------------------
    // classify
    // -------------------------------------------------------------------

    describe('classify', () => {
        it('classifies fetching errors as CODE_ERROR', () => {
            const err = RenderError.classify('fetching', new Error('404'));
            expect(err.type).toBe('CODE_ERROR');
        });

        it('classifies preparing errors as CODE_ERROR', () => {
            const err = RenderError.classify('preparing', new Error('npm install failed'));
            expect(err.type).toBe('CODE_ERROR');
        });

        it('classifies bundling errors as BUNDLE_ERROR', () => {
            const err = RenderError.classify('bundling', new Error('webpack error'));
            expect(err.type).toBe('BUNDLE_ERROR');
        });

        it('classifies rendering errors as RENDER_ERROR', () => {
            const err = RenderError.classify('rendering', new Error('chromium crash'));
            expect(err.type).toBe('RENDER_ERROR');
        });

        it('classifies uploading errors as UPLOAD_ERROR', () => {
            const err = RenderError.classify('uploading', new Error('S3 error'));
            expect(err.type).toBe('UPLOAD_ERROR');
        });

        it('classifies unknown stages as RENDER_ERROR', () => {
            const err = RenderError.classify('unknown', new Error('something'));
            expect(err.type).toBe('RENDER_ERROR');
        });

        it('handles non-Error values', () => {
            const err = RenderError.classify('bundling', 'string error');
            expect(err.type).toBe('BUNDLE_ERROR');
            expect(err.message).toContain('string error');
        });
    });

    // -------------------------------------------------------------------
    // toUserString
    // -------------------------------------------------------------------

    describe('toUserString', () => {
        it('combines user message with sanitised internal details', () => {
            const err = RenderError.code('ReferenceError: foo is not defined');
            const userStr = err.toUserString();

            expect(userStr).toContain('syntax or runtime error');
            expect(userStr).toContain('ReferenceError');
        });

        it('sanitises temp paths from error messages', () => {
            const err = RenderError.bundle('Error in /tmp/renderflow-abc123/index.tsx');
            const userStr = err.toUserString();

            expect(userStr).not.toContain('/tmp/renderflow');
            expect(userStr).toContain('<temp_path>');
        });

        it('truncates very long error messages', () => {
            const longMessage = 'x'.repeat(1000);
            const err = RenderError.render(longMessage);
            const userStr = err.toUserString();

            // Total includes the user message prefix
            expect(userStr.length).toBeLessThan(1500);
        });
    });

    // -------------------------------------------------------------------
    // Type guard
    // -------------------------------------------------------------------

    describe('is', () => {
        it('returns true for RenderError instances', () => {
            expect(RenderError.is(RenderError.code('test'))).toBe(true);
        });

        it('returns false for regular Error instances', () => {
            expect(RenderError.is(new Error('test'))).toBe(false);
        });

        it('returns false for non-error values', () => {
            expect(RenderError.is(null)).toBe(false);
            expect(RenderError.is(undefined)).toBe(false);
            expect(RenderError.is('string')).toBe(false);
        });
    });

    // -------------------------------------------------------------------
    // Retry policy constants
    // -------------------------------------------------------------------

    describe('ERROR_RETRY_POLICY', () => {
        it('CODE_ERROR is not retryable', () => {
            expect(ERROR_RETRY_POLICY.CODE_ERROR.retryable).toBe(false);
            expect(ERROR_RETRY_POLICY.CODE_ERROR.maxRetries).toBe(0);
        });

        it('BUNDLE_ERROR is not retryable', () => {
            expect(ERROR_RETRY_POLICY.BUNDLE_ERROR.retryable).toBe(false);
        });

        it('RENDER_ERROR allows 2 retries', () => {
            expect(ERROR_RETRY_POLICY.RENDER_ERROR.retryable).toBe(true);
            expect(ERROR_RETRY_POLICY.RENDER_ERROR.maxRetries).toBe(2);
        });

        it('UPLOAD_ERROR allows 3 retries', () => {
            expect(ERROR_RETRY_POLICY.UPLOAD_ERROR.retryable).toBe(true);
            expect(ERROR_RETRY_POLICY.UPLOAD_ERROR.maxRetries).toBe(3);
        });

        it('TIMEOUT_ERROR is not retryable', () => {
            expect(ERROR_RETRY_POLICY.TIMEOUT_ERROR.retryable).toBe(false);
        });
    });
});
