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

/** Uploads, counted per account rather than per IP. */
export const uploadLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.userId ?? 'anonymous',
  message: 'You have uploaded a lot of files in the last hour. Wait a while, then try again.',
});
