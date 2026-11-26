import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import {
  MAX_LINK_LABEL_LENGTH,
  MAX_VIEWS_PAGE_SIZE,
  MIN_LINK_PASSWORD_LENGTH,
  VIEWS_PAGE_SIZE,
  type LinkDetailResponse,
  type LinkResponse,
  type LinksResponse,
  type LinkViewsResponse,
} from '@tracked-links/shared';
import { loadLinkDetail, loadLinkStats, loadLinkViews } from '../lib/analytics';
import { HttpError } from '../lib/httpError';
import { newSlug, serializeLink } from '../lib/links';
import { findOwnedDocument, findOwnedLink } from '../lib/owned';
import { BCRYPT_ROUNDS, fitsBcrypt } from '../lib/passwords';
import { currentUserId, requireAuth } from '../middleware/auth';
import { DocumentModel } from '../models/Document';
import { Link } from '../models/Link';
import { View } from '../models/View';

const label = z
  .string({ error: 'Enter a label for this link.' })
  .trim()
  .min(1, { error: 'Enter a label for this link.' })
  .max(MAX_LINK_LABEL_LENGTH, { error: `Use a label of ${MAX_LINK_LABEL_LENGTH} characters or fewer.` });

const linkPassword = z
  .string({ error: 'Enter a password for this link.' })
  .min(MIN_LINK_PASSWORD_LENGTH, {
    error: `Use at least ${MIN_LINK_PASSWORD_LENGTH} characters for the link password.`,
  })
  .refine(fitsBcrypt, { error: 'Use a link password of 72 characters or fewer.' });

const expiresAt = z.iso.datetime({ offset: true, error: 'Choose a valid expiry date, or leave it empty.' });

const createSchema = z.object({
  label,
  requireEmail: z.boolean().default(false),
  password: linkPassword.nullable().default(null),
  allowDownload: z.boolean().default(false),
  expiresAt: expiresAt.nullable().default(null),
});

const updateSchema = z.object({
  label: label.optional(),
  requireEmail: z.boolean().optional(),
  /** A new password, null to remove it, or absent to keep the current one. */
  password: linkPassword.nullable().optional(),
  allowDownload: z.boolean().optional(),
  expiresAt: expiresAt.nullable().optional(),
  isActive: z.boolean().optional(),
});

const PAST_EXPIRY = 'Choose a date from today onwards, or leave it empty to keep the link open.';

function parseExpiry(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function assertFuture(date: Date | null) {
  if (date && date.getTime() <= Date.now()) {
    throw new HttpError(400, PAST_EXPIRY, { code: 'invalid_input', fields: { expiresAt: PAST_EXPIRY } });
  }
}

const viewsQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_VIEWS_PAGE_SIZE, { error: `Ask for ${MAX_VIEWS_PAGE_SIZE} views or fewer at a time.` })
    .default(VIEWS_PAGE_SIZE),
});

function isDuplicateSlug(error: unknown): boolean {
  const err = error as { code?: number; keyPattern?: Record<string, unknown> };
  return err.code === 11000 && Boolean(err.keyPattern?.slug);
}

/** The link's document, for its title and page count. Deleting a document deletes its links, so this is a safeguard. */
async function linkDocument(documentId: Types.ObjectId) {
  const doc = await DocumentModel.findById(documentId, { title: 1, pageCount: 1 }).lean();
  if (!doc) throw new HttpError(404, "This link's document was deleted.", { code: 'not_found' });
  return doc;
}

/* /documents/:id/links: listing and creating a document's links. */

export const documentLinksRouter = Router({ mergeParams: true });

documentLinksRouter.get('/', async (req, res) => {
  const params = req.params as { id: string };
  const doc = await findOwnedDocument(params.id, currentUserId(req));
  const links = await Link.find({ documentId: doc._id }).sort({ createdAt: -1 }).lean();
  const stats = await loadLinkStats(links.map((link) => link._id));
  const body: LinksResponse = {
    links: links.map((link) => serializeLink(link, doc.pageCount, stats.get(link._id.toString()))),
  };
  res.json(body);
});

documentLinksRouter.post('/', async (req, res) => {
  const params = req.params as { id: string };
  const ownerId = currentUserId(req);
  const input = createSchema.parse(req.body ?? {});
  const doc = await findOwnedDocument(params.id, ownerId);

  const expiry = parseExpiry(input.expiresAt);
  assertFuture(expiry);
  const passwordHash = input.password ? await bcrypt.hash(input.password, BCRYPT_ROUNDS) : null;

  // A clash among 62^10 slugs is next to impossible, but retry rather than fail if it happens.
  for (let attempt = 0; ; attempt += 1) {
    try {
      const link = await Link.create({
        documentId: doc._id,
        ownerId,
        slug: newSlug(),
        label: input.label,
        requireEmail: input.requireEmail,
        passwordHash,
        allowDownload: input.allowDownload,
        expiresAt: expiry,
      });
      const body: LinkResponse = { link: serializeLink(link, doc.pageCount) };
      res.status(201).json(body);
      return;
    } catch (error) {
      if (!isDuplicateSlug(error) || attempt >= 4) throw error;
    }
  }
});

/* /links/:id: one link's settings. */

export const linksRouter = Router();
linksRouter.use(requireAuth);

linksRouter.get('/:id', async (req, res) => {
  const link = await findOwnedLink(req.params.id, currentUserId(req));
  const doc = await linkDocument(link.documentId);
  const [stats, detail] = await Promise.all([loadLinkStats([link._id]), loadLinkDetail(link._id)]);

  const body: LinkDetailResponse = {
    link: serializeLink(link, doc.pageCount, stats.get(link._id.toString())),
    document: { id: doc._id.toString(), title: doc.title, pageCount: doc.pageCount },
    ...detail,
  };
  res.json(body);
});

/** The link's views, newest first, a page at a time: ?cursor= from the previous page's nextCursor. */
linksRouter.get('/:id/views', async (req, res) => {
  const query = viewsQuerySchema.parse(req.query);
  const link = await findOwnedLink(req.params.id, currentUserId(req));
  const body: LinkViewsResponse = await loadLinkViews(link._id, query);
  res.json(body);
});

linksRouter.patch('/:id', async (req, res) => {
  const input = updateSchema.parse(req.body ?? {});
  const link = await findOwnedLink(req.params.id, currentUserId(req));

  if (input.label !== undefined) link.label = input.label;
  if (input.requireEmail !== undefined) link.requireEmail = input.requireEmail;
  if (input.allowDownload !== undefined) link.allowDownload = input.allowDownload;
  if (input.isActive !== undefined) link.isActive = input.isActive;
  if (input.password !== undefined) {
    link.passwordHash = input.password ? await bcrypt.hash(input.password, BCRYPT_ROUNDS) : null;
  }
  if (input.expiresAt !== undefined) {
    const next = parseExpiry(input.expiresAt);
    // Only a changed date must be in the future, so an expired link can still be renamed.
    if ((next?.getTime() ?? null) !== (link.expiresAt?.getTime() ?? null)) assertFuture(next);
    link.expiresAt = next;
  }

  await link.save();
  const [doc, stats] = await Promise.all([linkDocument(link.documentId), loadLinkStats([link._id])]);
  const body: LinkResponse = { link: serializeLink(link, doc.pageCount, stats.get(link._id.toString())) };
  res.json(body);
});

linksRouter.delete('/:id', async (req, res) => {
  const link = await findOwnedLink(req.params.id, currentUserId(req));
  await View.deleteMany({ linkId: link._id });
  await link.deleteOne();
  res.status(204).end();
});
