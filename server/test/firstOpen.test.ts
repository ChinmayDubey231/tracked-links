import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstOpenEmail, settleFirstOpenEmails } from '../src/lib/firstOpen';
import { Link } from '../src/models/Link';
import { mailer, ResendMailer, type MemoryMailer } from '../src/services/email';
import { app, setupDatabase, signUp, teardownDatabase, uploadPdf } from './helpers';

beforeAll(setupDatabase);
afterAll(teardownDatabase);

const outbox = (mailer as MemoryMailer).sent;
beforeEach(() => {
  outbox.length = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
});

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function sharedLink(settings: Record<string, unknown> = {}) {
  const owner = await signUp({ name: 'Chinmay Dubey' });
  const uploaded = await uploadPdf(owner.token, 2);
  const res = await request(app)
    .post(`/documents/${uploaded.body.document.id}/links`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ label: 'Accenture application', ...settings })
    .expect(201);
  return { owner, slug: res.body.link.slug as string, linkId: res.body.link.id as string };
}

async function open(slug: string, { userAgent = CHROME, ...body }: Record<string, unknown> & { userAgent?: string } = {}) {
  const res = await request(app).post(`/v/${slug}/access`).set('User-Agent', userAgent).send(body).expect(201);
  return res.body.view as { id: string; token: string };
}

/** One heartbeat of reading time on page 1, then waits for any email it queued. */
async function read(view: { id: string; token: string }, ms = 8000) {
  await request(app)
    .post(`/views/${view.id}/heartbeat`)
    .send({ token: view.token, pages: [{ page: 1, ms }], maxPage: 1 })
    .expect(204);
  await settleFirstOpenEmails();
}

describe('first-open email', () => {
  it('emails the owner once, when the link is first read', async () => {
    const { owner, slug, linkId } = await sharedLink();
    const view = await open(slug);
    await settleFirstOpenEmails();
    expect(outbox).toHaveLength(0); // Opening alone isn't reading: no time yet.

    await read(view);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      to: owner.user.email,
      subject: '“Accenture application” was just opened',
      idempotencyKey: `first-open-${linkId}`,
    });
    expect(outbox[0]!.text).toContain('Hi Chinmay,');
    expect(outbox[0]!.text).toContain('Someone opened Resume and projects.pdf through your link “Accenture application”.');
    expect(outbox[0]!.text).toContain(`http://localhost:5173/links/${linkId}`);
    expect((await Link.findById(linkId))?.notifiedAt).toBeInstanceOf(Date);

    await read(view);
    await read(await open(slug));
    expect(outbox).toHaveLength(1);
  });

  it('names the reader when the link asked for an email', async () => {
    const { slug } = await sharedLink({ requireEmail: true });
    await read(await open(slug, { email: 'priya.s@example.com' }));
    expect(outbox[0]!.text).toContain('priya.s@example.com opened Resume and projects.pdf');
  });

  it('sends nothing for bots, empty views or the owner’s own preview', async () => {
    const { owner, slug, linkId } = await sharedLink();
    await read(await open(slug, { userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }));
    await read(await open(slug, { automated: true }));
    await read(await open(slug), 0);
    const preview = await request(app).post(`/v/${slug}/access`).set('Authorization', `Bearer ${owner.token}`).send({});
    expect(preview.body.view).toBeNull();

    await settleFirstOpenEmails();
    expect(outbox).toHaveLength(0);
    expect((await Link.findById(linkId))?.notifiedAt).toBeNull();
  });

  it('tries again on the next view when sending fails', async () => {
    const { slug, linkId } = await sharedLink();
    vi.spyOn(mailer, 'send').mockRejectedValueOnce(new Error('Resend is down'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await read(await open(slug));
    expect(logged).toHaveBeenCalledWith('Could not send the first-open email:', expect.any(Error));
    expect((await Link.findById(linkId))?.notifiedAt).toBeNull();

    await read(await open(slug));
    expect(outbox).toHaveLength(1);
  });

  it('escapes what the owner and reader typed in the HTML version', () => {
    const email = firstOpenEmail({
      ownerName: 'Chinmay Dubey',
      ownerEmail: 'owner@example.com',
      linkId: 'abc123',
      linkLabel: 'R&D <team>',
      documentTitle: 'Resume "final".pdf',
      viewerEmail: null,
    });
    expect(email.html).toContain('R&amp;D &lt;team&gt;');
    expect(email.html).toContain('Resume &quot;final&quot;.pdf');
    expect(email.html).not.toContain('<team>');
  });
});

describe('ResendMailer', () => {
  const message = { to: 'owner@example.com', subject: 'Hello', text: 'Hi', html: '<p>Hi</p>', idempotencyKey: 'key-1' };

  it('posts the email to the Resend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await new ResendMailer('re_test_key', 'Tracked Links <onboarding@resend.dev>').send(message);
    } finally {
      vi.unstubAllGlobals();
    }

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer re_test_key', 'Idempotency-Key': 'key-1' });
    expect(JSON.parse(init.body)).toEqual({
      from: 'Tracked Links <onboarding@resend.dev>',
      to: ['owner@example.com'],
      subject: 'Hello',
      text: 'Hi',
      html: '<p>Hi</p>',
    });
  });

  it('throws with Resend’s reason when it refuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"message":"Invalid API key"}', { status: 403 })));
    try {
      await expect(new ResendMailer('bad', 'a@b.c').send(message)).rejects.toThrow(/403.*Invalid API key/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
