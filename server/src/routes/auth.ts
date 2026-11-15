import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  type AuthResponse,
  type MeResponse,
  type PublicUser,
} from '@tracked-links/shared';
import { config } from '../config';
import { HttpError } from '../lib/httpError';
import { currentUserId, requireAuth, signToken } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimits';
import { User } from '../models/User';

const BCRYPT_ROUNDS = config.isTest ? 4 : 12;
/** Compared against when the email is unknown, so both paths take the same time. */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const email = z
  .string({ error: 'Enter your email address.' })
  .trim()
  .toLowerCase()
  .min(1, { error: 'Enter your email address.' })
  .pipe(z.email({ error: 'Enter a valid email address, like you@example.com.' }));

const newPassword = z
  .string({ error: 'Enter a password.' })
  .min(MIN_PASSWORD_LENGTH, { error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.` })
  .refine((value) => Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES, {
    error: 'Use a password of 72 characters or fewer.',
  });

const signupSchema = z.object({
  name: z
    .string({ error: 'Enter your name.' })
    .trim()
    .min(1, { error: 'Enter your name.' })
    .max(80, { error: 'Use a name of 80 characters or fewer.' }),
  email,
  password: newPassword,
});

const loginSchema = z.object({
  email,
  password: z.string({ error: 'Enter your password.' }).min(1, { error: 'Enter your password.' }),
});

export function toPublicUser(user: { _id: { toString(): string }; name: string; email: string; createdAt: Date }): PublicUser {
  return { id: user._id.toString(), name: user.name, email: user.email, createdAt: user.createdAt.toISOString() };
}

export const authRouter = Router();

authRouter.post('/signup', authLimiter, async (req, res) => {
  const input = signupSchema.parse(req.body ?? {});
  if (await User.exists({ email: input.email })) {
    throw new HttpError(409, 'An account with this email already exists. Log in instead.', {
      code: 'email_taken',
      fields: { email: 'An account with this email already exists. Log in instead.' },
    });
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await User.create({ name: input.name, email: input.email, passwordHash });
  const body: AuthResponse = { token: signToken(user._id.toString()), user: toPublicUser(user) };
  res.status(201).json(body);
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const input = loginSchema.parse(req.body ?? {});
  const user = await User.findOne({ email: input.email });
  const matches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !matches) {
    throw new HttpError(401, 'That email and password do not match. Check both and try again.', {
      code: 'invalid_credentials',
    });
  }
  const body: AuthResponse = { token: signToken(user._id.toString()), user: toPublicUser(user) };
  res.json(body);
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(currentUserId(req));
  if (!user) {
    throw new HttpError(401, 'Your account could not be found. Log in again.', { code: 'unauthenticated' });
  }
  const body: MeResponse = { user: toPublicUser(user) };
  res.json(body);
});
