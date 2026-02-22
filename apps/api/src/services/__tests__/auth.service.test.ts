/**
 * Unit tests for auth service functions.
 *
 * Uses in-memory mocks for the database — no real PostgreSQL required.
 */
import { describe, it, expect } from 'vitest';

import {
    hashPassword,
    verifyPassword,
} from '../auth.service.js';

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------

describe('hashPassword / verifyPassword', () => {
    it('hashes a password and verifies it', async () => {
        const password = 'mySecurePassword123';
        const hash = await hashPassword(password);

        expect(hash).not.toBe(password);
        expect(hash).toMatch(/^\$2[aby]?\$/); // bcrypt prefix

        const valid = await verifyPassword(password, hash);
        expect(valid).toBe(true);
    });

    it('rejects wrong password', async () => {
        const hash = await hashPassword('correct-password');
        const valid = await verifyPassword('wrong-password', hash);
        expect(valid).toBe(false);
    });

    it('produces different hashes for the same password', async () => {
        const password = 'samePassword';
        const hash1 = await hashPassword(password);
        const hash2 = await hashPassword(password);

        expect(hash1).not.toBe(hash2); // different salts
    });
});
