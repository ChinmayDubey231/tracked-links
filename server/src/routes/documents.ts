import { Router } from 'express';
import multer from 'multer';
import { Types } from 'mongoose';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  ANALYTICS_RANGES,
  MAX_THUMBNAIL_BYTES,
  MAX_UPLOAD_BYTES,
  type DocumentAnalyticsResponse,
  type DocumentResponse,
  type DocumentsResponse,
  type DocumentSummary,
  type SignedFileResponse,
} from '@tracked-links/shared';
import { loadDocumentReading, loadLinkStats, loadNotOpened, loadRecentViews } from '../lib/analytics';
import { refuseInDemo } from '../lib/demo';
import { cleanTitle, isPng, looksLikePdf, readPdfInfo } from '../lib/files';
import { HttpError } from '../lib/httpError';
import { serializeLink } from '../lib/links';
import { findOwnedDocument } from '../lib/owned';
import { countedViewFilter } from '../lib/views';
import { currentUserId, requireAuth } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimits';
import { DocumentModel } from '../models/Document';
import { Link } from '../models/Link';
import { View } from '../models/View';
import { storage } from '../services/storage';
import { documentLinksRouter } from './links';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 2, fields: 4, parts: 6 },
  defParamCharset: 'utf8',
});

interface DocumentLike {
  _id: Types.ObjectId;
  title: string;
  pageCount: number;
  sizeBytes: number;
  version?: number | null;
  createdAt: Date;
  replacedAt?: Date | null;
  thumbnailKey?: string | null;
}

interface DocumentStats {
  views: number;
  avgReadMs: number | null;
  lastViewedAt: Date | null;
  linkCount: number;
}

const EMPTY_STATS: DocumentStats = { views: 0, avgReadMs: null, lastViewedAt: null, linkCount: 0 };

/** View and link counts for a set of documents, in two aggregate queries. */
async function loadStats(documentIds: Types.ObjectId[]): Promise<Map<string, DocumentStats>> {
  const stats = new Map<string, DocumentStats>();
  if (documentIds.length === 0) return stats;

  const [viewRows, linkRows] = await Promise.all([
    View.aggregate<{ _id: Types.ObjectId; views: number; avgReadMs: number; lastViewedAt: Date }>([
      { $match: { documentId: { $in: documentIds }, ...countedViewFilter } },
      {
        $group: {
          _id: '$documentId',
          views: { $sum: 1 },
          avgReadMs: { $avg: '$totalDurationMs' },
          lastViewedAt: { $max: '$startedAt' },
        },
      },
    ]),
    Link.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { documentId: { $in: documentIds } } },
      { $group: { _id: '$documentId', count: { $sum: 1 } } },
    ]),
  ]);

  for (const row of viewRows) {
    stats.set(row._id.toString(), {
      ...EMPTY_STATS,
      views: row.views,
      avgReadMs: Math.round(row.avgReadMs),
      lastViewedAt: row.lastViewedAt,
    });
  }
  for (const row of linkRows) {
    const key = row._id.toString();
    stats.set(key, { ...(stats.get(key) ?? EMPTY_STATS), linkCount: row.count });
  }
  return stats;
}

async function serializeDocument(doc: DocumentLike, stats: DocumentStats = EMPTY_STATS): Promise<DocumentSummary> {
  const thumbnail = doc.thumbnailKey ? await storage.signedUrl(doc.thumbnailKey) : null;
  return {
    id: doc._id.toString(),
    title: doc.title,
    pageCount: doc.pageCount,
    sizeBytes: doc.sizeBytes,
    version: doc.version ?? 1,
    createdAt: doc.createdAt.toISOString(),
    replacedAt: doc.replacedAt ? doc.replacedAt.toISOString() : null,
    linkCount: stats.linkCount,
    views: stats.views,
    avgReadMs: stats.avgReadMs,
    lastViewedAt: stats.lastViewedAt ? stats.lastViewedAt.toISOString() : null,
    thumbnailUrl: thumbnail?.url ?? null,
  };
}

async function removeQuietly(key: string | null | undefined) {
  if (!key) return;
  try {
    await storage.remove(key);
  } catch (error) {
    console.warn(`Could not delete stored file ${key}:`, error);
  }
}

const uploadFields = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

interface CheckedUpload {
  pdf: Express.Multer.File;
  pageCount: number;
  /** A small first-page PNG from the owner's browser, when one came and it really is a PNG. */
  thumbnail: Express.Multer.File | null;
}

/** The uploaded PDF, checked by its content (not its name), with its page count. */
async function checkUpload(req: Express.Request): Promise<CheckedUpload> {
  const files = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;
  const pdf = files.file?.[0];
  if (!pdf) {
    throw new HttpError(400, 'Choose a PDF file to upload.', { code: 'no_file' });
  }
  if (!looksLikePdf(pdf.buffer)) {
    throw new HttpError(415, "This file isn't a PDF. Save or export it as a PDF, then upload it again.", {
      code: 'not_pdf',
    });
  }

  let pageCount: number;
  try {
    ({ pageCount } = await readPdfInfo(pdf.buffer));
  } catch {
    throw new HttpError(422, "We couldn't read this PDF. It may be damaged; export it again and retry.", {
      code: 'unreadable_pdf',
    });
  }

  // The thumbnail is optional: skip it silently if it is not a small PNG.
  const thumb = files.thumbnail?.[0];
  const thumbnail = thumb && thumb.size <= MAX_THUMBNAIL_BYTES && isPng(thumb.buffer) ? thumb : null;
  return { pdf, pageCount, thumbnail };
}

/** Stores the PDF and its thumbnail under new random keys. */
async function storeUpload(ownerId: string, { pdf, thumbnail }: CheckedUpload) {
  const fileKey = `documents/${ownerId}/${nanoid(16)}.pdf`;
  await storage.put(fileKey, pdf.buffer, 'application/pdf');
  let thumbnailKey: string | null = null;
  if (thumbnail) {
    thumbnailKey = `thumbnails/${ownerId}/${nanoid(16)}.png`;
    try {
      await storage.put(thumbnailKey, thumbnail.buffer, 'image/png');
    } catch (error) {
      await removeQuietly(fileKey);
      throw error;
    }
  }
  return { fileKey, thumbnailKey };
}

/** Demo sandboxes share the sample PDFs and never store anyone's files. Checked before the upload is read. */
const noDemoUploads = refuseInDemo('Uploading is turned off in the demo. Create a free account to upload your own PDFs.');

export const documentsRouter = Router();
documentsRouter.use(requireAuth);
documentsRouter.use('/:id/links', documentLinksRouter);

documentsRouter.get('/', async (req, res) => {
  const ownerId = currentUserId(req);
  const docs = await DocumentModel.find({ ownerId }).sort({ createdAt: -1 }).lean();
  const stats = await loadStats(docs.map((doc) => doc._id));

  const documents = await Promise.all(docs.map((doc) => serializeDocument(doc, stats.get(doc._id.toString()))));

  let latest: DocumentsResponse['totals']['latestView'] = null;
  let totalViews = 0;
  for (const doc of documents) {
    totalViews += doc.views;
    if (doc.lastViewedAt && (!latest || doc.lastViewedAt > latest.at)) {
      latest = { at: doc.lastViewedAt, documentId: doc.id, documentTitle: doc.title };
    }
  }

  const titles = new Map(documents.map((doc) => [doc.id, doc.title]));
  const body: DocumentsResponse = {
    documents,
    totals: { documents: documents.length, views: totalViews, latestView: latest },
    notOpened: await loadNotOpened(ownerId, titles),
  };
  res.json(body);
});

documentsRouter.post('/', noDemoUploads, uploadLimiter, uploadFields, async (req, res) => {
  const ownerId = currentUserId(req);
  const checked = await checkUpload(req);
  const bodyTitle = typeof req.body?.title === 'string' ? req.body.title : '';
  const title = cleanTitle(bodyTitle || checked.pdf.originalname);
  const { fileKey, thumbnailKey } = await storeUpload(ownerId, checked);

  try {
    const doc = await DocumentModel.create({
      ownerId,
      title,
      fileKey,
      thumbnailKey,
      pageCount: checked.pageCount,
      sizeBytes: checked.pdf.size,
    });
    const body: DocumentResponse = { document: await serializeDocument(doc) };
    res.status(201).json(body);
  } catch (error) {
    await Promise.all([removeQuietly(fileKey), removeQuietly(thumbnailKey)]);
    throw error;
  }
});

/**
 * Swaps in a new PDF and keeps the document, so every link already shared opens the new
 * file at the same address. The title stays. Earlier views stay too, each with the page
 * count of the version it read (View.pages).
 */
documentsRouter.post<{ id: string }>('/:id/replace', noDemoUploads, uploadLimiter, uploadFields, async (req, res) => {
  const ownerId = currentUserId(req);
  const doc = await findOwnedDocument(req.params.id, ownerId);
  const checked = await checkUpload(req);
  const { fileKey, thumbnailKey } = await storeUpload(ownerId, checked);

  let updated;
  try {
    // Only if nobody replaced it since we read it, so two tabs can't leave a stored file orphaned.
    updated = await DocumentModel.findOneAndUpdate(
      { _id: doc._id, ownerId, version: doc.version ?? 1 },
      {
        $set: { fileKey, thumbnailKey, pageCount: checked.pageCount, sizeBytes: checked.pdf.size, replacedAt: new Date() },
        $inc: { version: 1 },
      },
      { returnDocument: 'after' },
    ).lean();
  } catch (error) {
    await Promise.all([removeQuietly(fileKey), removeQuietly(thumbnailKey)]);
    throw error;
  }
  if (!updated) {
    await Promise.all([removeQuietly(fileKey), removeQuietly(thumbnailKey)]);
    throw new HttpError(409, 'This document was replaced in another tab a moment ago. Reload the page to see the latest version.', {
      code: 'conflict',
    });
  }

  await Promise.all([removeQuietly(doc.fileKey), removeQuietly(doc.thumbnailKey)]);
  const stats = await loadStats([updated._id]);
  const body: DocumentResponse = { document: await serializeDocument(updated, stats.get(updated._id.toString())) };
  res.json(body);
});

documentsRouter.get('/:id', async (req, res) => {
  const doc = await findOwnedDocument(req.params.id, currentUserId(req));
  const stats = await loadStats([doc._id]);
  const body: DocumentResponse = { document: await serializeDocument(doc, stats.get(doc._id.toString())) };
  res.json(body);
});

const analyticsQuerySchema = z.object({
  range: z.enum(ANALYTICS_RANGES, { error: 'Choose a date range of all, 30d or 7d.' }).default('all'),
});

/** Everything the Document analytics screen shows, in one response. */
documentsRouter.get('/:id/analytics', async (req, res) => {
  const { range } = analyticsQuerySchema.parse(req.query);
  const doc = await findOwnedDocument(req.params.id, currentUserId(req));
  const links = await Link.find({ documentId: doc._id }).sort({ createdAt: -1 }).lean();
  const labels = new Map(links.map((link) => [link._id.toString(), link.label]));

  const [docStats, reading, linkStats, recentViews] = await Promise.all([
    loadStats([doc._id]),
    loadDocumentReading(doc._id, doc.pageCount, range),
    loadLinkStats(links.map((link) => link._id)),
    loadRecentViews(doc._id, labels),
  ]);

  const body: DocumentAnalyticsResponse = {
    document: await serializeDocument(doc, docStats.get(doc._id.toString())),
    range,
    ...reading,
    links: links.map((link) => serializeLink(link, doc.pageCount, linkStats.get(link._id.toString()))),
    recentViews,
  };
  res.json(body);
});

/** A short-lived URL for the owner to render the PDF (analytics thumbnails, preview). */
documentsRouter.get('/:id/file', async (req, res) => {
  const doc = await findOwnedDocument(req.params.id, currentUserId(req));
  const signed = await storage.signedUrl(doc.fileKey, {
    downloadName: req.query.download === '1' ? doc.title : undefined,
  });
  const body: SignedFileResponse = { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  res.json(body);
});

documentsRouter.delete<{ id: string }>('/:id', refuseInDemo('Deleting documents is turned off in the demo.'), async (req, res) => {
  const doc = await findOwnedDocument(req.params.id, currentUserId(req));
  await Promise.all([View.deleteMany({ documentId: doc._id }), Link.deleteMany({ documentId: doc._id })]);
  await doc.deleteOne();
  await Promise.all([removeQuietly(doc.fileKey), removeQuietly(doc.thumbnailKey)]);
  res.status(204).end();
});
