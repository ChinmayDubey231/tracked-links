import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config';
import { DEMO_LIFETIME_MS, MAX_ACTIVE_DEMOS } from '../src/lib/demo';
import { settleFirstOpenEmails } from '../src/lib/firstOpen';
import { DocumentModel } from '../src/models/Document';
import { Link } from '../src/models/Link';
import { User } from '../src/models/User';
import { View } from '../src/models/View';
import { mailer, type MemoryMailer } from '../src/services/email';
import { app, makePdf, setupDatabase, teardownDatabase, TINY_PNG } from './helpers';

beforeAll(setupDatabase);
afterAll(teardownDatabase);
afterEach(() => {
  vi.restoreAllMocks();
});

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function startDemo() {
  const res = await request(app).post('/auth/demo').expect(201);
  return { token: res.body.token as string, user: res.body.user };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('demo sandbox', () => {
  it('starts with the sample documents, links and views, all due to expire', async () => {
    const before = Date.now();
    const { token, user } = await startDemo();
    expect(user.name).toBe('Neha Verma');
    expect(user.email).toMatch(/^demo-[a-z0-9]{12}@demo\.invalid$/);
    const expiresAt = new Date(user.demoExpiresAt).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + DEMO_LIFETIME_MS);
    expect(expiresAt).toBeLessThan(Date.now() + DEMO_LIFETIME_MS + 1000);

    const res = await request(app).get('/documents').set(auth(token)).expect(200);
    expect(res.body.documents.map((doc: { title: string; pageCount: number }) => [doc.title, doc.pageCount])).toEqual([
      ['Neha Verma, Certificates', 3],
      ['Neha Verma, Portfolio', 4],
      ['Neha Verma, Resume', 2],
    ]);
    expect(res.body.documents.every((doc: { thumbnailUrl: string | null }) => doc.thumbnailUrl)).toBe(true);
    expect(res.body.totals).toMatchObject({ documents: 3, views: 17, latestView: { documentTitle: 'Neha Verma, Resume' } });
    expect(res.body.notOpened.oldest.label).toBe('Northwind Retail referral');

    // Every record is tied to the sandbox's lifetime.
    const ownerId = user.id;
    const docs = await DocumentModel.find({ ownerId }).lean();
    const links = await Link.find({ ownerId }).lean();
    const views = await View.find({ documentId: { $in: docs.map((doc) => doc._id) } }).lean();
    expect([docs.length, links.length, views.length]).toEqual([3, 8, 17]);
    for (const record of [...docs, ...links, ...views]) {
      expect(record.demoExpiresAt?.toISOString()).toBe(user.demoExpiresAt);
    }

    // The resume's links show every status and reading state.
    const resume = res.body.documents.find((doc: { title: string }) => doc.title === 'Neha Verma, Resume');
    const analytics = await request(app).get(`/documents/${resume.id}/analytics`).set(auth(token)).expect(200);
    const byLabel = Object.fromEntries(
      analytics.body.links.map((link: { label: string; status: string; reading: { state: string } }) => [
        link.label,
        [link.status, link.reading.state],
      ]),
    );
    expect(byLabel).toEqual({
      'Brightline Labs application': ['active', 'read'],
      'LinkedIn profile': ['active', 'stopped'],
      'Campus placement cell': ['expired', 'read'],
      'Northwind Retail referral': ['active', 'unopened'],
    });
  });

  it('serves the sample PDF to anyone who opens a demo link', async () => {
    const { token } = await startDemo();
    const docs = await request(app).get('/documents').set(auth(token)).expect(200);
    const portfolio = docs.body.documents.find((doc: { title: string }) => doc.title === 'Neha Verma, Portfolio');
    const links = await request(app).get(`/documents/${portfolio.id}/links`).set(auth(token)).expect(200);

    const access = await request(app).post(`/v/${links.body.links[0].slug}/access`).set('User-Agent', CHROME).send({}).expect(201);
    const url = new URL(access.body.file.url);
    const file = await request(app).get(url.pathname + url.search).expect(200);
    expect(file.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('gives each visitor a sandbox of their own', async () => {
    const first = await startDemo();
    const second = await startDemo();
    expect(first.user.id).not.toBe(second.user.id);

    const firstDocs = await request(app).get('/documents').set(auth(first.token)).expect(200);
    await request(app).get(`/documents/${firstDocs.body.documents[0].id}`).set(auth(second.token)).expect(404);

    const slugs = await Link.find({ ownerId: { $in: [first.user.id, second.user.id] } }).distinct('slug');
    expect(slugs).toHaveLength(16);
  });

  it('refuses uploads, replacing files and deleting documents', async () => {
    const { token } = await startDemo();
    const docs = await request(app).get('/documents').set(auth(token)).expect(200);
    const docId = docs.body.documents[0].id;
    const pdf = await makePdf(2);

    const upload = await request(app)
      .post('/documents')
      .set(auth(token))
      .attach('file', pdf, { filename: 'mine.pdf', contentType: 'application/pdf' })
      .attach('thumbnail', TINY_PNG, { filename: 'thumb.png', contentType: 'image/png' })
      .expect(403);
    expect(upload.body.error).toMatchObject({
      code: 'demo_read_only',
      message: 'Uploading is turned off in the demo. Create a free account to upload your own PDFs.',
    });

    await request(app)
      .post(`/documents/${docId}/replace`)
      .set(auth(token))
      .attach('file', pdf, { filename: 'mine.pdf', contentType: 'application/pdf' })
      .expect(403);
    await request(app).delete(`/documents/${docId}`).set(auth(token)).expect(403);
    expect(await DocumentModel.exists({ _id: docId })).toBeTruthy();
  });

  it('lets a demo make links, which expire with it and never email', async () => {
    const outbox = (mailer as MemoryMailer).sent;
    outbox.length = 0;
    const { token, user } = await startDemo();
    const docs = await request(app).get('/documents').set(auth(token)).expect(200);
    const created = await request(app)
      .post(`/documents/${docs.body.documents[0].id}/links`)
      .set(auth(token))
      .send({ label: 'My test link' })
      .expect(201);
    const link = await Link.findById(created.body.link.id).lean();
    expect(link?.demoExpiresAt?.toISOString()).toBe(user.demoExpiresAt);

    // A visitor opens it in a private window and reads it.
    const access = await request(app).post(`/v/${created.body.link.slug}/access`).set('User-Agent', CHROME).send({}).expect(201);
    const view = access.body.view as { id: string; token: string };
    await request(app)
      .post(`/views/${view.id}/heartbeat`)
      .send({ token: view.token, pages: [{ page: 1, ms: 8000 }], maxPage: 1 })
      .expect(204);
    await settleFirstOpenEmails();

    expect((await View.findById(view.id).lean())?.demoExpiresAt?.toISOString()).toBe(user.demoExpiresAt);
    expect(outbox).toHaveLength(0);
    expect((await Link.findById(link?._id).lean())?.notifiedAt).toBeNull();

    const updated = await request(app).get(`/links/${created.body.link.id}`).set(auth(token)).expect(200);
    expect(updated.body.link.views).toBe(1);
  });

  it('issues a session that ends with the sandbox and can’t be logged into', async () => {
    const { token, user } = await startDemo();
    const payload = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload;
    expect(payload.demo).toBe(true);
    expect(Math.abs(payload.exp! * 1000 - new Date(user.demoExpiresAt).getTime())).toBeLessThan(2000);

    const me = await request(app).get('/auth/me').set(auth(token)).expect(200);
    expect(me.body.user.demoExpiresAt).toBe(user.demoExpiresAt);

    await request(app).post('/auth/login').send({ email: user.email, password: 'anything at all' }).expect(401);
  });

  it('has MongoDB delete demo records when they expire', async () => {
    for (const model of [User, DocumentModel, Link, View] as mongoose.Model<unknown>[]) {
      const indexes = await model.collection.indexes();
      expect(indexes.find((index) => index.key.demoExpiresAt === 1)).toMatchObject({ expireAfterSeconds: 0, sparse: true });
    }
  });

  it('refuses a new sandbox when too many are running', async () => {
    vi.spyOn(User, 'countDocuments').mockResolvedValueOnce(MAX_ACTIVE_DEMOS as never);
    const res = await request(app).post('/auth/demo').expect(503);
    expect(res.body.error.code).toBe('demo_busy');
  });

  it('leaves real accounts without an expiry', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ name: 'Real Owner', email: `real-${Date.now()}@example.com`, password: 'correct horse battery' })
      .expect(201);
    expect(res.body.user.demoExpiresAt).toBeNull();
    const stored = await User.findById(res.body.user.id).lean();
    expect(stored && 'demoExpiresAt' in stored).toBe(false);
    expect((jwt.verify(res.body.token, config.JWT_SECRET) as jwt.JwtPayload).demo).toBeUndefined();
  });
});
