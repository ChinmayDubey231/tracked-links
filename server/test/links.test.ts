import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Link } from '../src/models/Link';
import { View } from '../src/models/View';
import { app, setupDatabase, signUp, teardownDatabase, uploadPdf } from './helpers';

beforeAll(setupDatabase);
afterAll(teardownDatabase);

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

async function ownerWithDocument(pages = 3) {
  const owner = await signUp();
  const uploaded = await uploadPdf(owner.token, pages);
  return { ...owner, documentId: uploaded.body.document.id as string };
}

function createLink(token: string, documentId: string, body: Record<string, unknown>) {
  return request(app).post(`/documents/${documentId}/links`).set('Authorization', `Bearer ${token}`).send(body);
}

describe('POST /documents/:id/links', () => {
  it('creates a link with a random 10-character slug and hashes its password', async () => {
    const { token, documentId } = await ownerWithDocument();
    const expiresAt = inDays(9);
    const res = await createLink(token, documentId, {
      label: '  TCS application ',
      requireEmail: true,
      password: 'open-sesame',
      allowDownload: false,
      expiresAt,
    }).expect(201);

    expect(res.body.link).toMatchObject({
      label: 'TCS application',
      documentId,
      requireEmail: true,
      hasPassword: true,
      allowDownload: false,
      isActive: true,
      status: 'active',
      views: 0,
      expiresAt,
    });
    expect(res.body.link.slug).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(res.body.link.passwordHash).toBeUndefined();

    const stored = await Link.findById(res.body.link.id);
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('gives each link its own slug', async () => {
    const { token, documentId } = await ownerWithDocument();
    const a = await createLink(token, documentId, { label: 'A', expiresAt: null }).expect(201);
    const b = await createLink(token, documentId, { label: 'B', expiresAt: null }).expect(201);
    expect(a.body.link.slug).not.toBe(b.body.link.slug);
  });

  it('explains a missing label, a short password and a past expiry date', async () => {
    const { token, documentId } = await ownerWithDocument();
    const bad = await createLink(token, documentId, { label: ' ', password: 'abc' }).expect(400);
    expect(bad.body.error.fields).toMatchObject({
      label: 'Enter a label for this link.',
      password: expect.stringMatching(/at least 6/),
    });

    const past = await createLink(token, documentId, { label: 'Old', expiresAt: inDays(-1) }).expect(400);
    expect(past.body.error.fields.expiresAt).toMatch(/from today onwards/);
  });

  it("refuses another owner's document", async () => {
    const { documentId } = await ownerWithDocument();
    const stranger = await signUp();
    await createLink(stranger.token, documentId, { label: 'Mine now' }).expect(404);
  });
});

describe('GET /documents/:id/links', () => {
  it('lists the links newest first, with counted views only', async () => {
    const { token, documentId } = await ownerWithDocument();
    const first = await createLink(token, documentId, { label: 'First' }).expect(201);
    await createLink(token, documentId, { label: 'Second' }).expect(201);

    const link = await Link.findById(first.body.link.id);
    await View.create([
      { linkId: link!._id, documentId: link!.documentId, totalDurationMs: 12_000 },
      { linkId: link!._id, documentId: link!.documentId, totalDurationMs: 0 },
    ]);

    const res = await request(app)
      .get(`/documents/${documentId}/links`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.links.map((l: { label: string }) => l.label)).toEqual(['Second', 'First']);
    expect(res.body.links[1].views).toBe(1);
    expect(res.body.links[1].lastViewedAt).toEqual(expect.any(String));
  });
});

describe('GET, PATCH and DELETE /links/:id', () => {
  it('returns the link with its document and unique viewers', async () => {
    const { token, documentId } = await ownerWithDocument(4);
    const created = await createLink(token, documentId, { label: 'Infosys' }).expect(201);
    const link = await Link.findById(created.body.link.id);
    await View.create([
      { linkId: link!._id, documentId: link!.documentId, totalDurationMs: 5_000, viewerEmail: 'a@example.com' },
      { linkId: link!._id, documentId: link!.documentId, totalDurationMs: 5_000, viewerEmail: 'a@example.com' },
      { linkId: link!._id, documentId: link!.documentId, totalDurationMs: 5_000, ipHash: 'abc' },
    ]);

    const res = await request(app).get(`/links/${link!._id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.link).toMatchObject({ label: 'Infosys', views: 3 });
    expect(res.body.document).toMatchObject({ id: documentId, pageCount: 4 });
    expect(res.body.uniqueViewers).toBe(2);
  });

  it('switches a link off and on, and changes or removes its password', async () => {
    const { token, documentId } = await ownerWithDocument();
    const created = await createLink(token, documentId, { label: 'Wipro', password: 'first-pass' }).expect(201);
    const id = created.body.link.id;
    const patch = (body: Record<string, unknown>) =>
      request(app).patch(`/links/${id}`).set('Authorization', `Bearer ${token}`).send(body);

    const off = await patch({ isActive: false }).expect(200);
    expect(off.body.link).toMatchObject({ isActive: false, status: 'off' });

    const on = await patch({ isActive: true, label: 'Wipro referral' }).expect(200);
    expect(on.body.link).toMatchObject({ isActive: true, status: 'active', label: 'Wipro referral', hasPassword: true });

    // Leaving the password out keeps it.
    const before = (await Link.findById(id))!.passwordHash;
    await patch({ allowDownload: true }).expect(200);
    expect((await Link.findById(id))!.passwordHash).toBe(before);

    const removed = await patch({ password: null }).expect(200);
    expect(removed.body.link.hasPassword).toBe(false);
  });

  it('lets an expired link be renamed without choosing a new date', async () => {
    const { token, documentId } = await ownerWithDocument();
    const created = await createLink(token, documentId, { label: 'Old one' }).expect(201);
    const past = new Date(Date.now() - 86_400_000);
    await Link.updateOne({ _id: created.body.link.id }, { expiresAt: past });

    const res = await request(app)
      .patch(`/links/${created.body.link.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Renamed', expiresAt: past.toISOString() })
      .expect(200);
    expect(res.body.link).toMatchObject({ label: 'Renamed', status: 'expired' });
  });

  it('deletes a link and its views, and hides links from other owners', async () => {
    const { token, documentId } = await ownerWithDocument();
    const stranger = await signUp();
    const created = await createLink(token, documentId, { label: 'Temp' }).expect(201);
    const id = created.body.link.id;
    await View.create({ linkId: id, documentId, totalDurationMs: 1_000 });

    await request(app).get(`/links/${id}`).set('Authorization', `Bearer ${stranger.token}`).expect(404);
    await request(app).delete(`/links/${id}`).set('Authorization', `Bearer ${stranger.token}`).expect(404);

    await request(app).delete(`/links/${id}`).set('Authorization', `Bearer ${token}`).expect(204);
    expect(await Link.exists({ _id: id })).toBeNull();
    expect(await View.countDocuments({ linkId: id })).toBe(0);
  });
});
