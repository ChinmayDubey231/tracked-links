import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { HttpError } from '../lib/httpError';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      /** The session is a demo sandbox (lib/demo.ts). */
      isDemo?: boolean;
    }
  }
}

/** A session token. A demo sandbox's token says so, and ends when the sandbox is deleted. */
export function signToken(userId: string, demoExpiresAt?: Date | null): string {
  if (demoExpiresAt) {
    const seconds = Math.max(60, Math.floor((demoExpiresAt.getTime() - Date.now()) / 1000));
    return jwt.sign({ demo: true }, config.JWT_SECRET, { subject: userId, algorithm: 'HS256', expiresIn: seconds });
  }
  return jwt.sign({}, config.JWT_SECRET, {
    subject: userId,
    algorithm: 'HS256',
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** Requires "Authorization: Bearer <jwt>" and sets req.userId and req.isDemo. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Log in to continue.', { code: 'unauthenticated' });
  }
  try {
    const payload = jwt.verify(header.slice('Bearer '.length), config.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub) throw new Error('Token has no subject');
    req.userId = payload.sub;
    req.isDemo = payload.demo === true;
  } catch {
    throw new HttpError(401, 'Your session has ended. Log in again to continue.', { code: 'unauthenticated' });
  }
  next();
}

/**
 * The signed-in user's id on a public route, or null. A missing, expired or bad
 * token is ignored rather than refused, since anyone may use these routes.
 */
export function optionalUserId(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice('Bearer '.length), config.JWT_SECRET, { algorithms: ['HS256'] });
    return typeof payload === 'string' ? null : (payload.sub ?? null);
  } catch {
    return null;
  }
}

/** The authenticated user's id. Only call after requireAuth. */
export function currentUserId(req: Request): string {
  if (!req.userId) throw new HttpError(401, 'Log in to continue.', { code: 'unauthenticated' });
  return req.userId;
}
