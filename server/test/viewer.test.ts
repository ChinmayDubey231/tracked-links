import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Link } from '../src/models/Link';
import { View } from '../src/models/View';
import { app, setupDatabase, signUp, teardownDatabase, uploadPdf } from './helpers';

beforeAll(setupDatabase);
afterAll(teardownDatabase);

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function sharedLink(settings: Record<string, unknown> = {}, pages = 4) {
  const owner = await signUp({ name: 'Chinmay Dubey' });
  const uploaded = await uploadPdf(owner.token, pages);
  const res = await request(app)
    .post(`/documents/${uploaded.body.document.id}/links`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ label: 'TCS application', ...settings })
    .expect(201);
  return { owner, slug: res.body.link.slug as string, linkId: res.body.link.id as string };
}

async function openLink(slug: string, body: Record<string, unknown> = {}) {
  const res = await request(app).post(`/v/${slug}/access`).set('User-Agent', CHROME_WINDOWS).send(body).expect(201);
  return res.body as { view: { id: string; token: string }; file: { url: string }; pageCount: number };
}

describe('GET /v/:slug', () => {
  it('returns what the gate shows, without creating a view', async () => {
    const { slug } = await sharedLink({ requireEmail: true, password: 'let-me-in' });
    const res = await request(app).get(`/v/${slug}`).expect(200);
    expect(res.body).toEqual({
      title: 'Resume and projects.pdf',
      pageCount: 4,
      ownerName: 'Chinmay Dubey',
      requireEmail: true,
      requirePassword: true,
    });
    expect(await View.countDocuments({})).toBe(0);
  });

  it('refuses unknown, switched-off and expired links with a reason', async () => {
    await request(app).get('/v/doesNotExist1').expect(404);
    await request(app).get('/v/bad').expect(404);

    const off = await sharedLink();
    await Link.updateOne({ slug: off.slug }, { isActive: false });
    const offRes = await request(app).get(`/v/${off.slug}`).expect(410);
    expect(offRes.body.error.code).toBe('link_off');

    const expired = await sharedLink();
    await Link.updateOne({ slug: expired.slug }, { expiresAt: new Date(Date.now() - 1000) });
    const expiredRes = await request(app).post(`/v/${expired.slug}/access`).send({}).expect(410);
    expect(expiredRes.body.error.code).toBe('link_expired');
  });
});

describe('POST /v/:slug/access', () => {
  it('creates a view with a slot per page, the device and a hashed IP', async () => {
    const { slug, linkId } = await sharedLink();
    const body = await openLink(slug);

    expect(body.view).toEqual({ id: expect.any(String), token: expect.any(String) });
    expect(body.pageCount).toBe(4);

    const view = await View.findById(body.view.id).lean();
    expect(view).toMatchObject({
      device: 'Desktop',
      browser: 'Chrome',
      os: 'Windows',
      totalDurationMs: 0,
      documentVersion: 1,
    });
    expect(view!.linkId.toString()).toBe(linkId);
    expect(view!.pages.map((p) => p.page)).toEqual([1, 2, 3, 4]);
    expect(view!.ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(view!.ipHash).not.toContain('127.0.0.1');
  });

  it('returns a signed file URL that serves the PDF', async () => {
    const { slug } = await sharedLink();
    const { file } = await openLink(slug);
    const url = new URL(file.url);
    const pdf = await request(app).get(url.pathname + url.search).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
  });

  it('asks for a valid email when the link requires one, and records it', async () => {
    const { slug } = await sharedLink({ requireEmail: true });
    const missing = await request(app).post(`/v/${slug}/access`).send({}).expect(400);
    expect(missing.body.error.fields.email).toMatch(/Enter your email/);

    const invalid = await request(app).post(`/v/${slug}/access`).send({ email: 'not-an-email' }).expect(400);
    expect(invalid.body.error.fields.email).toMatch(/valid email/);

    const body = await openLink(slug, { email: ' Priya.S@Example.com ' });
    expect((await View.findById(body.view.id))?.viewerEmail).toBe('priya.s@example.com');
  });

  it('checks the link password', async () => {
    const { slug } = await sharedLink({ password: 'open-sesame' });
    const wrong = await request(app).post(`/v/${slug}/access`).send({ password: 'guess' }).expect(403);
    expect(wrong.body.error.code).toBe('wrong_password');
    expect(wrong.body.error.fields.password).toMatch(/isn't right/);
    await openLink(slug, { password: 'open-sesame' });
  });

  it("records nothing when the owner opens their own link", async () => {
    const { slug, owner, linkId } = await sharedLink();
    const res = await request(app)
      .post(`/v/${slug}/access`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})
      .expect(201);
    expect(res.body.view).toBeNull();
    expect(res.body.file.url).toEqual(expect.any(String));
    expect(await View.countDocuments({ linkId })).toBe(0);
  });
});

describe('POST /views/:viewId/heartbeat', () => {
  it('adds time per page with $inc and keeps the furthest page', async () => {
    const { slug } = await sharedLink();
    const { view } = await openLink(slug);
    const beat = (body: Record<string, unknown>) =>
      request(app).post(`/views/${view.id}/heartbeat`).send({ token: view.token, ...body });

    await beat({ pages: [{ page: 1, ms: 8_000 }], maxPage: 1 }).expect(204);
    await beat({ pages: [{ page: 1, ms: 2_000 }, { page: 2, ms: 5_000 }], maxPage: 3 }).expect(204);
    await beat({ pages: [], maxPage: 2 }).expect(204);

    const stored = await View.findById(view.id).lean();
    expect(stored!.totalDurationMs).toBe(15_000);
    expect(stored!.pages.map((p) => p.durationMs)).toEqual([10_000, 5_000, 0, 0]);
    expect(stored!.maxPageReached).toBe(3);
  });

  it('accepts the text/plain body navigator.sendBeacon sends', async () => {
    const { slug } = await sharedLink();
    const { view } = await openLink(slug);
    await request(app)
      .post(`/views/${view.id}/heartbeat`)
      .set('Content-Type', 'text/plain;charset=UTF-8')
      .send(JSON.stringify({ token: view.token, pages: [{ page: 4, ms: 3_000 }], maxPage: 4 }))
      .expect(204);
    const stored = await View.findById(view.id).lean();
    expect(stored!.pages[3]!.durationMs).toBe(3_000);
    expect(stored!.maxPageReached).toBe(4);
  });

  it('caps one heartbeat at two minutes and ignores pages the document does not have', async () => {
    const { slug } = await sharedLink();
    const { view } = await openLink(slug);
    await request(app)
      .post(`/views/${view.id}/heartbeat`)
      .send({
        token: view.token,
        pages: [
          { page: 1, ms: 100_000 },
          { page: 9, ms: 50_000 },
          { page: 2, ms: 100_000 },
        ],
        maxPage: 99,
      })
      .expect(204);
    const stored = await View.findById(view.id).lean();
    expect(stored!.totalDurationMs).toBe(120_000);
    expect(stored!.pages.map((p) => p.durationMs)).toEqual([100_000, 20_000, 0, 0]);
    expect(stored!.maxPageReached).toBe(4);
  });

  it('refuses a wrong token', async () => {
    const { slug } = await sharedLink();
    const { view } = await openLink(slug);
    await request(app)
      .post(`/views/${view.id}/heartbeat`)
      .send({ token: 'forged', pages: [{ page: 1, ms: 5_000 }], maxPage: 1 })
      .expect(403);
    expect((await View.findById(view.id))!.totalDurationMs).toBe(0);
  });
});

describe('POST /v/:slug/download', () => {
  it('issues no download URL when downloads are off', async () => {
    const { slug } = await sharedLink({ allowDownload: false });
    const { view } = await openLink(slug);
    const res = await request(app)
      .post(`/v/${slug}/download`)
      .send({ viewId: view.id, token: view.token })
      .expect(403);
    expect(res.body.error.code).toBe('download_off');
  });

  it('gives a reader with a view of this link a download URL', async () => {
    const { slug } = await sharedLink({ allowDownload: true });
    const { view } = await openLink(slug);
    await request(app).post(`/v/${slug}/download`).send({}).expect(403);

    const res = await request(app).post(`/v/${slug}/download`).send({ viewId: view.id, token: view.token }).expect(200);
    const url = new URL(res.body.url);
    expect(url.searchParams.get('dl')).toBe('Resume and projects.pdf');
    const file = await request(app).get(url.pathname + url.search).expect(200);
    expect(file.headers['content-disposition']).toMatch(/^attachment/);
  });
});
