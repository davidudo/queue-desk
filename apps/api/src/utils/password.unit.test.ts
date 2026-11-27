import { describe, expect, it } from 'vitest';
import { hashPassword, hashToken, verifyPassword } from './password.js';

describe('password & token utilities', () => {
  it('hashes and verifies a valid password', async () => {
    const hash = await hashPassword('QueueDesk!Test2026');
    expect(hash).toContain(':');
    await expect(verifyPassword('QueueDesk!Test2026', hash)).resolves.toBe(true);
    await expect(verifyPassword('WrongPassword123', hash)).resolves.toBe(false);
  });

  it('returns false for malformed password hashes', async () => {
    await expect(verifyPassword('anything', 'not-a-valid-hash')).resolves.toBe(false);
  });

  it('produces deterministic sha256 token hashes', () => {
    const a = hashToken('sample-jwt-token');
    const b = hashToken('sample-jwt-token');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});
