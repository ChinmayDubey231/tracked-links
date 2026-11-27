import bcrypt from 'bcryptjs';
import express, { Router, type Request } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type {
  AccessResponse,
  HeartbeatRequest,
  PublicLinkResponse,
  SignedFileResponse,
} from '@tracked-links/shared';
import { HttpError } from '../lib/httpError';
import { SLUG_PATTERN, linkStatus } from '../lib/links';
import { parseUserAgent } from '../lib/userAgent';
import { hashIp, isValidViewToken, viewToken } from '../lib/viewerIdentity';
import { optionalUserId } from '../middleware/auth';
import { accessLimiter, heartbeatLimiter, publicLinkLimiter } from '../middleware/rateLimits';
import { DocumentModel } from '../models/Document';
import { Link } from '../models/Link';
import { User } from '../models/User';
import { View } from '../models/View';
import { storage } from '../services/storage';

/** The most reading time one heartbeat may add. The client sends one every 10 seconds. */
const MAX_HEARTBEAT_MS = 120_000;
/** Heartbeats for a View older than this are ignored, so a tab left open for days can't keep adding time. */
const MAX_SESSION_MS = 12 * 60 * 60 * 1000;

const LINK_NOT_FOUND = new HttpError(
  404,
  'Nothing is shared at this address. Check that you copied the whole link, or ask the person who sent it for a new one.',
  { code: 'link_not_found' },
);

/**
 * Loads a link that may be opened right now, with its document. Switched-off,
 * expired and unknown links are refused with a message for the reader.
 */
async function loadOpenLink(slug: string) {
  if (!SLUG_PATTERN.test(slug)) throw LINK_NOT_FOUND;
  const link = await Link.findOne({ slug });
  if (!link) throw LINK_NOT_FOUND;

  const status = linkStatus(link);
  if (status === 'off') {
    throw new HttpError(410, 'The person who shared this document has switched this link off. Ask them for a new one.', {
      code: 'link_off',
    });
  }
  if (status === 'expired') {
    throw new HttpError(
      410,
      'The person who shared this document set an end date for this link, and it has passed. Ask them for a new one.',
      { code: 'link_expired' },
    );
  }

  const doc = await DocumentModel.findById(link.documentId);
  if (!doc) throw LINK_NOT_FOUND;
  return { link, doc };
}

const accessSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).optional(),
  password: z.string().max(200).optional(),
});

const emailSchema = z.email();

function fieldError(status: number, field: string, message: string, code: string) {
  return new HttpError(status, message, { code, fields: { [field]: message } });
}

/** Beacons arrive as text/plain (so the browser sends them cross-origin without a preflight); fetches as JSON. */
function parseBody(body: unknown): unknown {
  if (typeof body !== 'string') return body ?? {};
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, 'The request body was not valid JSON.', { code: 'invalid_json' });
  }
}

function downloadName(title: string): string {
  return /\.pdf$/i.test(title) ? title : `${title}.pdf`;
}

/* /v/:slug: what a reader's browser calls. */

export const viewerRouter = Router();

/** The gate's details. Never creates a View: link-preview bots fetch pages but don't run JavaScript. */
viewerRouter.get<{ slug: string }>('/:slug', publicLinkLimiter, async (req, res) => {
  const { link, doc } = await loadOpenLink(req.params.slug);
  const owner = await User.findById(link.ownerId, { name: 1 }).lean();
  const body: PublicLinkResponse = {
    title: doc.title,
    pageCount: doc.pageCount,
    ownerName: owner?.name ?? 'Someone',
    requireEmail: Boolean(link.requireEmail),
    requirePassword: Boolean(link.passwordHash),
  };
  res.json(body);
});

/** Checks the gate, starts a View and returns a short-lived URL of the PDF. */
viewerRouter.post<{ slug: string }>('/:slug/access', accessLimiter, async (req, res) => {
  const input = accessSchema.parse(req.body ?? {});
  const { link, doc } = await loadOpenLink(req.params.slug);

  let viewerEmail: string | null = null;
  if (link.requireEmail) {
    if (!input.email) {
      throw fieldError(400, 'email', 'Enter your email address to open this document.', 'email_required');
    }
    if (!emailSchema.safeParse(input.email).success) {
      throw fieldError(400, 'email', 'Enter a valid email address, like name@company.com.', 'invalid_input');
    }
    viewerEmail = input.email;
  }

  if (link.passwordHash) {
    if (!input.password) {
      throw fieldError(400, 'password', 'Enter the password that came with the link.', 'password_required');
    }
    // 403, not 401: a 401 would sign out an owner previewing their own link.
    if (!(await bcrypt.compare(input.password, link.passwordHash))) {
      throw fieldError(
        403,
        'password',
        "That password isn't right. Check the message the link came with, then try again.",
        'wrong_password',
      );
    }
  }

  // The owner opening their own link sees exactly what readers see, but nothing is recorded.
  const isOwner = optionalUserId(req) === link.ownerId.toString();
  let view: AccessResponse['view'] = null;
  if (!isOwner) {
    const created = await View.create({
      linkId: link._id,
      documentId: doc._id,
      documentVersion: doc.version ?? 1,
      viewerEmail,
      pages: Array.from({ length: doc.pageCount }, (_, index) => ({ page: index + 1, durationMs: 0 })),
      maxPageReached: 1,
      ...parseUserAgent(req.get('user-agent')),
      ipHash: hashIp(req.ip),
    });
    const id = created._id.toString();
    view = { id, token: viewToken(id) };
  }

  const file = await storage.signedUrl(doc.fileKey);
  const body: AccessResponse = {
    view,
    title: doc.title,
    pageCount: doc.pageCount,
    allowDownload: Boolean(link.allowDownload),
    file: { url: file.url, expiresAt: file.expiresAt.toISOString() },
  };
  res.status(201).json(body);
});

const downloadSchema = z.object({
  viewId: z.string().optional(),
  token: z.string().max(200).optional(),
});

/** Reader is allowed to download when they hold a View of this link, or they own it. */
async function mayDownload(req: Request, linkId: Types.ObjectId, ownerId: Types.ObjectId): Promise<boolean> {
  if (optionalUserId(req) === ownerId.toString()) return true;
  const { viewId, token } = downloadSchema.parse(parseBody(req.body));
  if (!viewId || !Types.ObjectId.isValid(viewId) || !isValidViewToken(viewId, token)) return false;
  return Boolean(await View.exists({ _id: viewId, linkId }));
}

/**
 * A fresh download URL, asked for when the reader presses Download. With
 * "Allow download" off no download URL is ever issued (a deterrent only: the
 * PDF is still shown, and screenshots can't be stopped).
 */
viewerRouter.post<{ slug: string }>('/:slug/download', publicLinkLimiter, async (req, res) => {
  const { link, doc } = await loadOpenLink(req.params.slug);
  if (!link.allowDownload) {
    throw new HttpError(403, 'The person who shared this document has turned off downloads.', { code: 'download_off' });
  }
  if (!(await mayDownload(req, link._id, link.ownerId))) {
    throw new HttpError(403, 'Reload the page, then try downloading again.', { code: 'invalid_view_token' });
  }
  const signed = await storage.signedUrl(doc.fileKey, { downloadName: downloadName(doc.title) });
  const body: SignedFileResponse = { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  res.json(body);
});

/* /views/:viewId: reading time from an open document. */

const heartbeatSchema = z.object({
  token: z.string().max(200),
  pages: z
    .array(
      z.object({
        page: z.number().int().min(1).max(10_000),
        ms: z.number().min(0).max(MAX_HEARTBEAT_MS * 10),
      }),
    )
    .max(1000),
  maxPage: z.number().int().min(1).max(10_000),
}) satisfies z.ZodType<HeartbeatRequest>;

export const viewsRouter = Router();

/**
 * Adds reading time with $inc, so heartbeats from the same tab never overwrite
 * each other. Answers 204 with no body: the beacon on close can't read a reply.
 */
viewsRouter.post<{ viewId: string }>(
  '/:viewId/heartbeat',
  heartbeatLimiter,
  express.text({ type: 'text/plain', limit: '32kb' }),
  async (req, res) => {
    const input = heartbeatSchema.parse(parseBody(req.body));
    const { viewId } = req.params;
    if (!Types.ObjectId.isValid(viewId) || !isValidViewToken(viewId, input.token)) {
      throw new HttpError(403, 'This reading session is not valid. Reload the page.', { code: 'invalid_view_token' });
    }

    const view = await View.findById(viewId, { startedAt: 1, pages: 1 }).lean();
    if (!view) throw new HttpError(404, 'This reading session has ended. Reload the page.', { code: 'not_found' });
    if (Date.now() - view.startedAt.getTime() > MAX_SESSION_MS) {
      res.status(204).end();
      return;
    }

    const pageCount = view.pages.length;
    const inc: Record<string, number> = {};
    let total = 0;
    for (const { page, ms } of input.pages) {
      const add = Math.min(Math.round(ms), MAX_HEARTBEAT_MS - total);
      if (page > pageCount || add <= 0) continue;
      const key = `pages.${page - 1}.durationMs`;
      inc[key] = (inc[key] ?? 0) + add;
      total += add;
    }

    await View.updateOne(
      { _id: view._id },
      {
        $set: { lastSeenAt: new Date() },
        $max: { maxPageReached: Math.min(input.maxPage, Math.max(pageCount, 1)) },
        ...(total > 0 && { $inc: { ...inc, totalDurationMs: total } }),
      },
    );
    res.status(204).end();
  },
);
