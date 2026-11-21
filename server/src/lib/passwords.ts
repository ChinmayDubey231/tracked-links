import { MAX_PASSWORD_BYTES } from '@tracked-links/shared';
import { config } from '../config';

/** bcrypt cost: 12 in real use, 4 in tests so they stay fast. */
export const BCRYPT_ROUNDS = config.isTest ? 4 : 12;

/** bcrypt ignores everything after the first 72 bytes, so longer passwords are refused rather than cut short. */
export function fitsBcrypt(password: string): boolean {
  return Buffer.byteLength(password, 'utf8') <= MAX_PASSWORD_BYTES;
}
