import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits standard for GCM
const PREFIX = 'enc:v1:';

function getEncryptionKey(): Buffer {
  const secret =
    process.env.CREDENTIAL_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'codeskill-temporary-credential-secret-key-32b';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a temporary password using AES-256-GCM before database storage.
 */
export function encryptTemporaryPassword(password: string): string {
  if (!password) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted temporary password.
 * Preserves backwards compatibility with legacy plaintext entries if unencrypted.
 */
export function decryptTemporaryPassword(stored: string): string {
  if (!stored) return '';
  if (!stored.startsWith(PREFIX)) {
    return stored;
  }
  try {
    const parts = stored.slice(PREFIX.length).split(':');
    if (parts.length !== 3) {
      return stored;
    }
    const [ivHex, authTagHex, ciphertextHex] = parts;
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return stored;
  }
}
