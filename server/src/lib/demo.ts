import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { customAlphabet } from 'nanoid';
import { DocumentModel } from '../models/Document';
import { Link } from '../models/Link';
import { User } from '../models/User';
import { View } from '../models/View';
import { storage } from '../services/storage';
import { DEMO_OWNER_NAME, DEMO_TEMPLATE, type DemoFileName } from './demoTemplate';
import { readPdfInfo } from './files';
import { HttpError } from './httpError';
import { newSlug } from './links';

/*
 * Demo sandboxes. "Try the demo" gives each visitor their own copy of a sample account, with no
 * password, so they can make links and watch their own visits arrive without seeing anyone else's.
 *
 * Everything in a sandbox carries demoExpiresAt, and a TTL index on each collection has MongoDB
 * delete it at that time: no cleanup job, and a sandbox that fails halfway is cleaned up the same
 * way. Links and views made later inherit the date from their document and link.
 *
 * Sandboxes share the template PDFs, so a demo can't upload, replace or delete documents; that also
 * keeps strangers' files out of storage. Demo links never send the first-open email.
 */

export const DEMO_LIFETIME_MS = 24 * 60 * 60 * 1000;
/** Sandboxes alive at once. Each is about 30 KB in MongoDB; the cap keeps a flood from filling it. */
export const MAX_ACTIVE_DEMOS = 500;

/** Bump when the files in assets/demo change, so running servers don't serve stale copies. */
const ASSET_VERSION = 1;
/**
 * The storage keys' owner part for the shared template files. ObjectIds start with their creation
 * time, so no real account can have this one.
 */
const TEMPLATE_OWNER = '0'.repeat(24);
const FILE_NAMES: DemoFileName[] = ['resume', 'portfolio', 'certificates'];

/** Hash of a secret nobody keeps: no password can log in to a demo account. */
const UNUSABLE_PASSWORD_HASH = bcrypt.hashSync(randomBytes(32).toString('hex'), 4);
const sandboxId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);

interface DemoFile {
  fileKey: string;
  thumbnailKey: string;
  pageCount: number;
  sizeBytes: number;
}

/** server/assets/demo, whether the API runs from server/ (npm workspaces, Render) or the repo root. */
function assetsDir(): string {
  const candidates = [path.resolve('assets/demo'), path.resolve('server/assets/demo')];
  const found = candidates.find((dir) => existsSync(path.join(dir, 'resume.pdf')));
  if (!found) throw new Error(`Demo files not found. Looked in: ${candidates.join(', ')}`);
  return found;
}

async function storeDemoFiles(): Promise<Record<DemoFileName, DemoFile>> {
  const dir = assetsDir();
  const entries = await Promise.all(
    FILE_NAMES.map(async (name) => {
      const [pdf, png] = await Promise.all([
        readFile(path.join(dir, `${name}.pdf`)),
        readFile(path.join(dir, `${name}.png`)),
      ]);
      const { pageCount } = await readPdfInfo(pdf);
      const base = `demo-v${ASSET_VERSION}-${name}`;
      const file: DemoFile = {
        fileKey: `documents/${TEMPLATE_OWNER}/${base}.pdf`,
        thumbnailKey: `thumbnails/${TEMPLATE_OWNER}/${base}.png`,
        pageCount,
        sizeBytes: pdf.length,
      };
      await Promise.all([storage.put(file.fileKey, pdf, 'application/pdf'), storage.put(file.thumbnailKey, png, 'image/png')]);
      return [name, file] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<DemoFileName, DemoFile>;
}

let demoFiles: Promise<Record<DemoFileName, DemoFile>> | null = null;

/** Puts the template files in storage once per server start. A failure is retried by the next demo. */
function ensureDemoFiles() {
  demoFiles ??= storeDemoFiles().catch((error: unknown) => {
    demoFiles = null;
    throw error;
  });
  return demoFiles;
}

/** A stand-in for the salted IP hash real views carry: same shape, made from the template's reader name. */
function readerHash(reader: string): string {
  return createHash('sha256').update(`demo-reader:${reader}`).digest('hex');
}

/** Creates one visitor's sandbox and returns its user. */
export async function createDemoSandbox(now = new Date()) {
  const active = await User.countDocuments({ demoExpiresAt: { $gt: now } });
  if (active >= MAX_ACTIVE_DEMOS) {
    throw new HttpError(503, 'The demo is busy right now. Try again in a few hours, or create a free account.', {
      code: 'demo_busy',
    });
  }

  const files = await ensureDemoFiles();
  const demoExpiresAt = new Date(now.getTime() + DEMO_LIFETIME_MS);
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const ownerId = new Types.ObjectId();

  const documents = [];
  const links = [];
  const views = [];
  for (const docSpec of DEMO_TEMPLATE) {
    const file = files[docSpec.file];
    const documentId = new Types.ObjectId();
    documents.push({
      _id: documentId,
      ownerId,
      title: docSpec.title,
      fileKey: file.fileKey,
      thumbnailKey: file.thumbnailKey,
      pageCount: file.pageCount,
      sizeBytes: file.sizeBytes,
      createdAt: ago(docSpec.uploadedAgo),
      demoExpiresAt,
    });

    for (const linkSpec of docSpec.links) {
      const linkId = new Types.ObjectId();
      links.push({
        _id: linkId,
        documentId,
        ownerId,
        slug: newSlug(),
        label: linkSpec.label,
        requireEmail: Boolean(linkSpec.requireEmail),
        allowDownload: Boolean(linkSpec.allowDownload),
        isActive: linkSpec.isActive ?? true,
        expiresAt: linkSpec.expiredAgo === undefined ? null : ago(linkSpec.expiredAgo),
        createdAt: ago(linkSpec.createdAgo),
        demoExpiresAt,
      });

      for (const viewSpec of linkSpec.views) {
        if (viewSpec.seconds.length !== file.pageCount) {
          throw new Error(`Demo view on "${linkSpec.label}" has ${viewSpec.seconds.length} pages; ${docSpec.file}.pdf has ${file.pageCount}.`);
        }
        const startedAt = ago(viewSpec.ago);
        const totalDurationMs = viewSpec.seconds.reduce((sum, seconds) => sum + seconds * 1000, 0);
        views.push({
          linkId,
          documentId,
          documentVersion: 1,
          viewerEmail: viewSpec.email ?? null,
          startedAt,
          lastSeenAt: new Date(startedAt.getTime() + totalDurationMs + 5000),
          totalDurationMs,
          pages: viewSpec.seconds.map((seconds, index) => ({ page: index + 1, durationMs: seconds * 1000 })),
          maxPageReached: viewSpec.seconds.findLastIndex((seconds) => seconds > 0) + 1,
          ...viewSpec.on,
          ipHash: readerHash(viewSpec.reader),
          demoExpiresAt,
        });
      }
    }
  }

  await DocumentModel.insertMany(documents);
  await Link.insertMany(links);
  await View.insertMany(views);
  // The user last: the visitor's session points at it, so it only exists once its data does.
  return User.create({
    _id: ownerId,
    name: DEMO_OWNER_NAME,
    // .invalid never resolves (RFC 2606), so nothing can be delivered to it even by mistake.
    email: `demo-${sandboxId()}@demo.invalid`,
    passwordHash: UNUSABLE_PASSWORD_HASH,
    createdAt: now,
    demoExpiresAt,
  });
}

/** Refuses a route in a demo session (uploads, replacing and deleting files). */
export function refuseInDemo(message: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.isDemo) throw new HttpError(403, message, { code: 'demo_read_only' });
    next();
  };
}
