import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

const tokenKey = createHash('sha256').update(`view-token:${config.JWT_SECRET}`).digest();

/**
 * The secret a viewer's browser sends with each heartbeat, so only the tab that
 * opened a View can add reading time to it. Derived from the view id, so nothing
 * extra is stored.
 */
export function viewToken(viewId: string): string {
  return createHmac('sha256', tokenKey).update(viewId).digest('base64url');
}

export function isValidViewToken(viewId: string, token: unknown): boolean {
  if (typeof token !== 'string' || token.length === 0) return false;
  const expected = Buffer.from(viewToken(viewId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Salted SHA-256 of the viewer's IP address. The raw address is never stored. */
export function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${config.IP_HASH_SALT}:${ip}`).digest('hex');
}
