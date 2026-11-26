import { existsSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { DocumentModel } from '../src/models/Document';
import { View } from '../src/models/View';
import { TINY_PNG, app, makePdf, setupDatabase, signUp, teardownDatabase, uploadPdf } from './helpers';

beforeAll(setupDatabase);
afterAll(teardownDatabase);

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const stored = (key: string | null | undefined) => Boolean(key) && existsSync(path.resolve(config.LOCAL_STORAGE_DIR, key!));

async function replaceFile(token: string, documentId: string, pages: number, status = 200) {
  return request(app)
    .post(`/documents/${documentId}/replace`)
    .set('Authorization', `Bearer ${token}`)
    .attach('file', await makePdf(pages), { filename: 'resume-v2.pdf', contentType: 'application/pdf' })
    .attach('thumbnail', TINY_PNG, { filename: 'thumb.png', contentType: 'image/png' })
    .expect(status);
}

/** A 2-page document with one link. */
async function documentWithLink() {
  const owner = await signUp();
  const uploaded = await uploadPdf(owner.token, 2);
  const documentId = uploaded.body.document.id as string;
  const link = await request(app)
    .post(`/documents/${documentId}/links`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ label: 'TCS application' })
    .expect(201);
  return { owner, documentId, linkId: link.body.link.id as string, slug: link.body.link.slug as string };
}

/** A reader who reads every page of whatever version the link opens. */
async function readInFull(slug: string) {
  const access = await request(app).post(`/v/${slug}/access`).set('User-Agent', CHROME).send({}).expect(201);
  const { view, pageCount } = access.body as { view: { id: string; token: string }; pageCount: number };
  await request(app)
    .post(`/views/${view.id}/heartbeat`)
    .send({
      token: view.token,
      pages: Array.from({ length: pageCount }, (_, index) => ({ page: index + 1, ms: 6000 })),
      maxPage: pageCount,
    })
    .expect(204);
  return view.id;
}

describe('POST /documents/:id/replace', () => {
  it('swaps the file under the same document, so links open the new version', async () => {
    const { owner, documentId, slug } = await documentWithLink();
    const before = await DocumentModel.findById(documentId).lean();

    const res = await replaceFile(owner.token, documentId, 3);
    expect(res.body.document).toMatchObject({
      id: documentId,
      title: 'Resume and projects.pdf',
      pageCount: 3,
      version: 2,
      replacedAt: expect.any(String),
      linkCount: 1,
      thumbnailUrl: expect.any(String),
    });

    const after = await DocumentModel.findById(documentId).lean();
    expect(after!.fileKey).not.toBe(before!.fileKey);
    expect(stored(after!.fileKey)).toBe(true);
    expect(stored(before!.fileKey)).toBe(false);
    expect(stored(before!.thumbnailKey)).toBe(false);

    const access = await request(app).post(`/v/${slug}/access`).set('User-Agent', CHROME).send({}).expect(201);
    expect(access.body.pageCount).toBe(3);
    const view = await View.findById(access.body.view.id).lean();
    expect(view).toMatchObject({ documentVersion: 2 });
    expect(view!.pages).toHaveLength(3);
  });

  it('judges earlier views against the version they read', async () => {
    const { owner, documentId, linkId, slug } = await documentWithLink();
    await readInFull(slug); // Both pages of the 2-page version.
    await replaceFile(owner.token, documentId, 3);
    const auth = { Authorization: `Bearer ${owner.token}` };

    const link = await request(app).get(`/links/${linkId}`).set(auth).expect(200);
    expect(link.body.link.reading).toEqual({ state: 'read' });
    expect(link.body.reachedLastPage).toBe(1);
    expect(link.body.latestView).toMatchObject({ maxPageReached: 2, pageCount: 2 });

    const views = await request(app).get(`/links/${linkId}/views`).set(auth).expect(200);
    expect(views.body.views[0]).toMatchObject({ maxPageReached: 2, pageCount: 2 });

    const analytics = await request(app).get(`/documents/${documentId}/analytics`).set(auth).expect(200);
    expect(analytics.body.stats.reachedLastPage).toBe(1);
    expect(analytics.body.pages).toHaveLength(3);
    expect(analytics.body.recentViews[0]).toMatchObject({ maxPageReached: 2, pageCount: 2 });

    // A reader of the new version who stops at page 2 has not read it in full.
    const access = await request(app).post(`/v/${slug}/access`).set('User-Agent', CHROME).send({}).expect(201);
    await request(app)
      .post(`/views/${access.body.view.id}/heartbeat`)
      .send({ token: access.body.view.token, pages: [{ page: 2, ms: 5000 }], maxPage: 2 })
      .expect(204);
    const later = await request(app).get(`/links/${linkId}`).set(auth).expect(200);
    expect(later.body.link.reading).toEqual({ state: 'stopped', page: 2 });
    expect(later.body.reachedLastPage).toBe(1);
  });

  it('checks the new file the way an upload does, and keeps the old one on failure', async () => {
    const { owner, documentId } = await documentWithLink();
    const auth = { Authorization: `Bearer ${owner.token}` };

    const noFile = await request(app).post(`/documents/${documentId}/replace`).set(auth).expect(400);
    expect(noFile.body.error.code).toBe('no_file');

    const notPdf = await request(app)
      .post(`/documents/${documentId}/replace`)
      .set(auth)
      .attach('file', Buffer.from('just some text'), { filename: 'resume.pdf', contentType: 'application/pdf' })
      .expect(415);
    expect(notPdf.body.error.code).toBe('not_pdf');

    const doc = await DocumentModel.findById(documentId).lean();
    expect(doc).toMatchObject({ version: 1, pageCount: 2 });
    expect(stored(doc!.fileKey)).toBe(true);
  });

  it('is only for the owner', async () => {
    const { documentId } = await documentWithLink();
    const stranger = await signUp();
    await replaceFile(stranger.token, documentId, 3, 404);
    await request(app).post(`/documents/${documentId}/replace`).expect(401);
    expect(await DocumentModel.findById(documentId).lean()).toMatchObject({ version: 1 });
  });
});
