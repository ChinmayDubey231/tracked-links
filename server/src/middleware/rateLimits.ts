import { rateLimit, type Options } from 'express-rate-limit';
import { config } from '../config';

function limiter(options: Partial<Options> & { message: string }) {
  const { message, ...rest } = options;
  return rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (_req, res, _next, opts) => {
      res.status(opts.statusCode).json({ error: { message, code: 'rate_limited' } });
    },
    ...rest,
  });
}

/** Sign-up and log-in: slows down password guessing. */
export const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many attempts. Wait 15 minutes, then try again.',
});

/** Opening a shared link (POST /v/:slug/access): limits guessing link passwords. */
export const accessLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'Too many attempts to open this document. Wait 15 minutes, then try again.',
});

/** Reading a shared link's details and asking for a download. */
export const publicLinkLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  message: 'Too many requests for this document. Wait a few minutes, then try again.',
});

/**
 * Reading-time heartbeats: one every 10 seconds per open tab. Generous, since
 * a whole office can share one IP address.
 */
export const heartbeatLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 600,
  message: 'Too many updates. Reading time will be recorded again shortly.',
});

/** Uploads and file replacements, counted per account rather than per IP. */
export const uploadLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.userId ?? 'anonymous',
  message: 'You have uploaded a lot of files in the last hour. Wait a while, then try again.',
});
