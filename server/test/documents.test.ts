import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Link } from '../src/models/Link';
import { View } from '../src/models/View';
import { DocumentModel } from '../src/models/Document';
import { app, makePdf, setupDatabase, signUp, teardownDatabase, uploadPdf } from './helpers';

beforeAll(setupDatabase);
afterAll(teardownDatabase);

describe('POST /documents', () => {
  it('stores the PDF privately and counts its pages', async () => {
    const { token } = await signUp();
    const res = await uploadPdf(token, 4);

    expect(res.body.document).toMatchObject({
      title: 'Resume and projects.pdf',
      pageCount: 4,
      version: 1,
      views: 0,
      linkCount: 0,
      avgReadMs: null,
    });
    // Storage keys never leave the server; only signed URLs do.
    expect(res.body.document.fileKey).toBeUndefined();
    expect(res.body.document.thumbnailUrl).toMatch(/\/files\/thumbnails\/.+\?exp=\d+&sig=/);
  });

  it('rejects a file that only claims to be a PDF', async () => {
    const { token } = await signUp();
    const res = await request(app)
      .post('/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('just some text pretending'), { filename: 'fake.pdf', contentType: 'application/pdf' })
      .expect(415);
    expect(res.body.error.code).toBe('not_pdf');
  });

  it('rejects files over 10 MB', async () => {
    const { token } = await signUp();
    const big = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(10 * 1024 * 1024 + 1)]);
    const res = await request(app)
      .post('/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' })
      .expect(413);
    expect(res.body.error.code).toBe('file_too_large');
  });

  it('requires a login', async () => {
    await request(app).post('/documents').attach('file', await makePdf(1), 'a.pdf').expect(401);
  });
});

describe('signed file URLs', () => {
  it('serves the file with a valid signature and refuses a tampered one', async () => {
    const { token } = await signUp();
    const uploaded = await uploadPdf(token);
    const fileRes = await request(app)
      .get(`/documents/${uploaded.body.document.id}/file`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const url = new URL(fileRes.body.url);
    const ok = await request(app).get(url.pathname + url.search).expect(200);
    expect(ok.headers['content-type']).toBe('application/pdf');
    expect(ok.body.subarray(0, 5).toString()).toBe('%PDF-');

    url.searchParams.set('exp', String(Number(url.searchParams.get('exp')) + 1000));
    await request(app).get(url.pathname + url.search).expect(403);
  });
});

describe('GET /documents', () => {
  it("lists only the owner's documents, with view stats and headline totals", async () => {
    const owner = await signUp();
    const other = await signUp();
    const first = await uploadPdf(owner.token, 2, 'First.pdf');
    await uploadPdf(owner.token, 1, 'Second.pdf');
    await uploadPdf(other.token, 1, 'Not mine.pdf');

    const doc = await DocumentModel.findById(first.body.document.id);
    const link = await Link.create({ documentId: doc!._id, ownerId: doc!.ownerId, slug: 'abcdefghij', label: 'TCS' });
    const latest = new Date();
    await View.create([
      { linkId: link._id, documentId: doc!._id, totalDurationMs: 60_000, startedAt: new Date(Date.now() - 3_600_000) },
      { linkId: link._id, documentId: doc!._id, totalDurationMs: 30_000, startedAt: latest },
      // Zero active time: excluded from every number.
      { linkId: link._id, documentId: doc!._id, totalDurationMs: 0, startedAt: new Date() },
    ]);

    const res = await request(app).get('/documents').set('Authorization', `Bearer ${owner.token}`).expect(200);
    expect(res.body.documents.map((d: { title: string }) => d.title)).toEqual(['Second.pdf', 'First.pdf']);

    const firstDoc = res.body.documents[1];
    expect(firstDoc).toMatchObject({ views: 2, avgReadMs: 45_000, linkCount: 1 });
    expect(res.body.totals).toMatchObject({
      documents: 2,
      views: 2,
      latestView: { documentTitle: 'First.pdf', at: latest.toISOString() },
    });
  });
});

describe('GET and DELETE /documents/:id', () => {
  it("returns 404 for another user's document", async () => {
    const owner = await signUp();
    const stranger = await signUp();
    const uploaded = await uploadPdf(owner.token);
    await request(app)
      .get(`/documents/${uploaded.body.document.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(404);
    await request(app).get('/documents/not-an-id').set('Authorization', `Bearer ${owner.token}`).expect(404);
  });

  it('deletes the document with its links and views', async () => {
    const owner = await signUp();
    const uploaded = await uploadPdf(owner.token);
    const id = uploaded.body.document.id;
    const doc = await DocumentModel.findById(id);
    const link = await Link.create({ documentId: doc!._id, ownerId: doc!.ownerId, slug: 'zyxwvutsrq', label: 'X' });
    await View.create({ linkId: link._id, documentId: doc!._id, totalDurationMs: 5_000 });

    await request(app).delete(`/documents/${id}`).set('Authorization', `Bearer ${owner.token}`).expect(204);
    expect(await DocumentModel.exists({ _id: id })).toBeNull();
    expect(await Link.countDocuments({ documentId: id })).toBe(0);
    expect(await View.countDocuments({ documentId: id })).toBe(0);
  });
});
