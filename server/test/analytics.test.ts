import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Link } from '../src/models/Link';
import { View } from '../src/models/View';
import { app, setupDatabase, signUp, teardownDatabase, uploadPdf } from './helpers';

beforeAll(setupDatabase);
afterAll(teardownDatabase);

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface Owner {
  token: string;
}

async function createLink(owner: Owner, documentId: string, label: string) {
  const res = await request(app)
    .post(`/documents/${documentId}/links`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ label })
    .expect(201);
  return res.body.link.id as string;
}

/** A finished reading session, written straight to the database. */
async function seedView(
  ids: { linkId: string; documentId: string },
  options: {
    seconds: number[];
    maxPage: number;
    ago: number;
    email?: string;
    ip?: string;
    isBot?: boolean;
  },
) {
  const pages = options.seconds.map((s, index) => ({ page: index + 1, durationMs: s * 1000 }));
  const startedAt = new Date(Date.now() - options.ago);
  return View.create({
    ...ids,
    viewerEmail: options.email ?? null,
    ipHash: options.ip ?? null,
    startedAt,
    lastSeenAt: startedAt,
    totalDurationMs: pages.reduce((sum, page) => sum + page.durationMs, 0),
    pages,
    maxPageReached: options.maxPage,
    device: 'Desktop',
    browser: 'Chrome',
    os: 'Windows',
    isBot: options.isBot ?? false,
  });
}

/*
 * One 4-page document with three links:
 *   TCS application: priya (1h ago, read all), a.verma (3h ago, stopped at 2), priya again (10 days ago, read all).
 *   LinkedIn bio: an anonymous reader (2h ago, page 1 only), another (5 days ago, read all).
 *   Accenture application: never opened.
 * Plus a zero-time view and a bot view on TCS, which must not count anywhere.
 */
let owner: Owner;
let documentId: string;
let tcs: string;
let linkedIn: string;
let accenture: string;

beforeAll(async () => {
  owner = await signUp();
  const uploaded = await uploadPdf(owner.token, 4);
  documentId = uploaded.body.document.id;
  accenture = await createLink(owner, documentId, 'Accenture application');
  linkedIn = await createLink(owner, documentId, 'LinkedIn bio');
  tcs = await createLink(owner, documentId, 'TCS application');
  await Link.updateOne({ _id: accenture }, { createdAt: new Date(Date.now() - 20 * DAY) });
  await Link.updateOne({ _id: linkedIn }, { createdAt: new Date(Date.now() - 19 * DAY) });
  await Link.updateOne({ _id: tcs }, { createdAt: new Date(Date.now() - 18 * DAY) });

  const onTcs = { linkId: tcs, documentId };
  const onLinkedIn = { linkId: linkedIn, documentId };
  await seedView(onTcs, { email: 'priya.s@example.com', seconds: [20, 10, 5, 5], maxPage: 4, ago: HOUR });
  await seedView(onTcs, { email: 'a.verma@example.com', seconds: [30, 20, 0, 0], maxPage: 2, ago: 3 * HOUR });
  await seedView(onTcs, { email: 'priya.s@example.com', seconds: [10, 10, 10, 10], maxPage: 4, ago: 10 * DAY });
  await seedView(onLinkedIn, { ip: 'hash-a', seconds: [40, 0, 0, 0], maxPage: 1, ago: 2 * HOUR });
  await seedView(onLinkedIn, { ip: 'hash-b', seconds: [10, 10, 10, 10], maxPage: 4, ago: 5 * DAY });
  await seedView(onTcs, { email: 'zero@example.com', seconds: [0, 0, 0, 0], maxPage: 1, ago: 0 });
  await seedView(onTcs, { ip: 'bot', seconds: [50, 50, 0, 0], maxPage: 2, ago: 60_000, isBot: true });
});

function getAnalytics(range?: string) {
  return request(app)
    .get(`/documents/${documentId}/analytics${range ? `?range=${range}` : ''}`)
    .set('Authorization', `Bearer ${owner.token}`);
}

describe('GET /documents/:id/analytics', () => {
  it('computes the stats, page heat and reach from counted views only', async () => {
    const res = await getAnalytics().expect(200);
    expect(res.body.range).toBe('all');
    expect(res.body.stats).toEqual({
      views: 5,
      // priya counts once: same email on two views.
      uniqueViewers: 4,
      avgReadMs: 42_000,
      reachedLastPage: 0.6,
    });
    // Page time is divided by the views that reached the page: 110s/5, 50s/4, 25s/3, 25s/3.
    expect(res.body.pages).toEqual([
      { page: 1, avgMs: 22_000, reach: 1, heat: 0.264 },
      { page: 2, avgMs: 12_500, reach: 0.8, heat: 0.15 },
      { page: 3, avgMs: 8_333, reach: 0.6, heat: 0.1 },
      { page: 4, avgMs: 8_333, reach: 0.6, heat: 0.1 },
    ]);
    expect(res.body.headline).toBe('Reading time falls after page one.');
    expect(res.body.document).toMatchObject({ id: documentId, pageCount: 4, views: 5, linkCount: 3 });
  });

  it('gives each link its all-time numbers and a reading status from its latest view', async () => {
    const res = await getAnalytics('7d').expect(200);
    const byLabel = Object.fromEntries(
      (res.body.links as Array<{ label: string }>).map((link) => [link.label, link]),
    );
    expect(res.body.links.map((link: { label: string }) => link.label)).toEqual([
      'TCS application',
      'LinkedIn bio',
      'Accenture application',
    ]);
    expect(byLabel['TCS application']).toMatchObject({ views: 3, avgReadMs: 43_333, reading: { state: 'read' } });
    expect(byLabel['LinkedIn bio']).toMatchObject({ views: 2, reading: { state: 'stopped', page: 1 } });
    expect(byLabel['Accenture application']).toMatchObject({
      views: 0,
      avgReadMs: null,
      lastViewedAt: null,
      reading: { state: 'unopened' },
    });
  });

  it('lists the latest views across links, newest first', async () => {
    const res = await getAnalytics().expect(200);
    expect(
      res.body.recentViews.map((view: { linkLabel: string; viewerEmail: string | null; maxPageReached: number }) => [
        view.linkLabel,
        view.viewerEmail,
        view.maxPageReached,
      ]),
    ).toEqual([
      ['TCS application', 'priya.s@example.com', 4],
      ['LinkedIn bio', null, 1],
      ['TCS application', 'a.verma@example.com', 2],
      ['LinkedIn bio', null, 4],
      ['TCS application', 'priya.s@example.com', 4],
    ]);
  });

  it('limits the stats and pages to the date range', async () => {
    const res = await getAnalytics('7d').expect(200);
    expect(res.body.range).toBe('7d');
    expect(res.body.stats).toEqual({ views: 4, uniqueViewers: 4, avgReadMs: 42_500, reachedLastPage: 0.5 });
    expect(res.body.pages[0]).toMatchObject({ page: 1, avgMs: 25_000, reach: 1 });
  });

  it('holds back the headline until there are enough views', async () => {
    const other = await uploadPdf(owner.token, 2, 'Cover letter.pdf');
    const res = await request(app)
      .get(`/documents/${other.body.document.id}/analytics`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(res.body.headline).toBe('Not enough views yet to see a pattern.');
    expect(res.body.stats).toEqual({ views: 0, uniqueViewers: 0, avgReadMs: null, reachedLastPage: null });
    expect(res.body.pages).toEqual([
      { page: 1, avgMs: null, reach: 0, heat: 0.06 },
      { page: 2, avgMs: null, reach: 0, heat: 0.06 },
    ]);
    expect(res.body.links).toEqual([]);
    expect(res.body.recentViews).toEqual([]);
  });

  it('rejects an unknown range and hides other owners’ documents', async () => {
    const bad = await getAnalytics('1y').expect(400);
    expect(bad.body.error.code).toBe('invalid_input');

    const stranger = await signUp();
    await request(app)
      .get(`/documents/${documentId}/analytics`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(404);
    await request(app).get(`/documents/${documentId}/analytics`).expect(401);
  });
});

describe('GET /links/:id', () => {
  it('adds the readers, the views that reached the end and the latest view', async () => {
    const res = await request(app).get(`/links/${tcs}`).set('Authorization', `Bearer ${owner.token}`).expect(200);
    expect(res.body.uniqueViewers).toBe(2);
    expect(res.body.reachedLastPage).toBe(2);
    expect(res.body.latestView).toEqual({ at: expect.any(String), viewerEmail: 'priya.s@example.com', maxPageReached: 4 });
    expect(res.body.link).toMatchObject({ views: 3, reading: { state: 'read' } });
  });

  it('has no latest view for a link nobody opened', async () => {
    const res = await request(app).get(`/links/${accenture}`).set('Authorization', `Bearer ${owner.token}`).expect(200);
    expect(res.body).toMatchObject({ uniqueViewers: 0, reachedLastPage: 0, latestView: null });
  });
});

describe('GET /links/:id/views', () => {
  const views = (query = '') =>
    request(app).get(`/links/${tcs}/views${query}`).set('Authorization', `Bearer ${owner.token}`);

  it('pages through counted views, newest first', async () => {
    const first = await views('?limit=2').expect(200);
    expect(first.body.total).toBe(3);
    expect(first.body.views.map((view: { viewerEmail: string }) => view.viewerEmail)).toEqual([
      'priya.s@example.com',
      'a.verma@example.com',
    ]);
    expect(first.body.views[0]).toMatchObject({
      maxPageReached: 4,
      totalDurationMs: 40_000,
      device: 'Desktop',
      browser: 'Chrome',
      os: 'Windows',
    });
    expect(first.body.nextCursor).toEqual(expect.any(String));

    const second = await views(`?limit=2&cursor=${first.body.nextCursor}`).expect(200);
    expect(second.body.views).toHaveLength(1);
    expect(second.body.views[0].maxPageReached).toBe(4);
    expect(second.body.nextCursor).toBeNull();
  });

  it('returns everything on one page by default', async () => {
    const res = await views().expect(200);
    expect(res.body.views).toHaveLength(3);
    expect(res.body.nextCursor).toBeNull();
  });

  it('rejects a damaged cursor or too large a page', async () => {
    const cursor = await views('?cursor=not-a-cursor').expect(400);
    expect(cursor.body.error.code).toBe('invalid_cursor');
    await views('?limit=500').expect(400);
  });

  it('is only for the owner', async () => {
    const stranger = await signUp();
    await request(app).get(`/links/${tcs}/views`).set('Authorization', `Bearer ${stranger.token}`).expect(404);
  });
});

describe('GET /documents, not opened', () => {
  it('names the oldest active link nobody opened, ignoring expired and switched-off links', async () => {
    const res = await request(app).get('/documents').set('Authorization', `Bearer ${owner.token}`).expect(200);
    expect(res.body.notOpened).toEqual({
      count: 1,
      oldest: {
        linkId: accenture,
        label: 'Accenture application',
        createdAt: expect.any(String),
        documentId,
        documentTitle: 'Resume and projects.pdf',
      },
    });

    const expired = await createLink(owner, documentId, 'Expired one');
    await Link.updateOne({ _id: expired }, { expiresAt: new Date(Date.now() - 1000) });
    const off = await createLink(owner, documentId, 'Switched off');
    await request(app)
      .patch(`/links/${off}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ isActive: false })
      .expect(200);
    await createLink(owner, documentId, 'Infosys application');

    const after = await request(app).get('/documents').set('Authorization', `Bearer ${owner.token}`).expect(200);
    expect(after.body.notOpened.count).toBe(2);
    expect(after.body.notOpened.oldest.label).toBe('Accenture application');
  });

  it('is null when every link has been opened', async () => {
    const solo = await signUp();
    const uploaded = await uploadPdf(solo.token, 1);
    const linkId = await createLink(solo, uploaded.body.document.id, 'Only link');
    const before = await request(app).get('/documents').set('Authorization', `Bearer ${solo.token}`).expect(200);
    expect(before.body.notOpened.count).toBe(1);

    await seedView({ linkId, documentId: uploaded.body.document.id }, { seconds: [12], maxPage: 1, ago: HOUR });
    const after = await request(app).get('/documents').set('Authorization', `Bearer ${solo.token}`).expect(200);
    expect(after.body.notOpened).toBeNull();
  });
});
