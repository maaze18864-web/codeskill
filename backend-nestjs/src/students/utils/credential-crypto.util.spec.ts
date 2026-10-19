import {
  encryptTemporaryPassword,
  decryptTemporaryPassword,
} from './credential-crypto.util';

describe('credential-crypto.util', () => {
  it('encrypts and decrypts temporary password correctly', () => {
    const raw = 'SuperSecretP@ssw0rd!123';
    const encrypted = encryptTemporaryPassword(raw);

    expect(encrypted).toMatch(/^enc:v1:[a-f0-9]{24}:[a-f0-9]{32}:[a-f0-9]+$/);
    expect(encrypted).not.toContain(raw);

    const decrypted = decryptTemporaryPassword(encrypted);
    expect(decrypted).toBe(raw);
  });

  it('handles backwards compatibility for legacy plaintext passwords', () => {
    const legacyPassword = 'LegacyPlaintextPassword123';
    expect(decryptTemporaryPassword(legacyPassword)).toBe(legacyPassword);
  });

  it('returns empty string when given empty string', () => {
    expect(encryptTemporaryPassword('')).toBe('');
    expect(decryptTemporaryPassword('')).toBe('');
  });

  it('safely handles corrupted ciphertext without crashing', () => {
    const corrupted = 'enc:v1:000000000000000000000000:11111111111111111111111111111111:999999';
    expect(decryptTemporaryPassword(corrupted)).toBe(corrupted);
  });
});
