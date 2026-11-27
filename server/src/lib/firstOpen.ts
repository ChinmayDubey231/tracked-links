import type { Types } from 'mongoose';
import { config } from '../config';
import { DocumentModel } from '../models/Document';
import { Link } from '../models/Link';
import { User } from '../models/User';
import { mailer, type EmailMessage } from '../services/email';

/*
 * The email the owner gets the first time one of their links is read. "Read" matches
 * the dashboard's "Not opened": the first view with some active reading time, not a bot.
 */

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export interface FirstOpenDetails {
  ownerName: string;
  ownerEmail: string;
  linkId: string;
  linkLabel: string;
  documentTitle: string;
  viewerEmail: string | null;
}

export function firstOpenEmail(details: FirstOpenDetails): EmailMessage {
  const firstName = details.ownerName.trim().split(/\s+/)[0] || 'there';
  const who = details.viewerEmail ?? 'Someone';
  const linkUrl = `${config.publicBaseUrl}/links/${details.linkId}`;
  const footer = 'You get one email per link, the first time someone reads it.';

  const text = [
    `Hi ${firstName},`,
    '',
    `${who} opened ${details.documentTitle} through your link “${details.linkLabel}”.`,
    '',
    `See how they read it: ${linkUrl}`,
    '',
    footer,
    '',
    'Tracked Links',
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#F6F8FA">
<div style="max-width:520px;margin:0 auto;padding:28px;background:#FFFFFF;border:1px solid #E3E7EC;border-radius:12px;font-family:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#101418">
<p style="margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
<p style="margin:0 0 24px"><strong>${escapeHtml(who)}</strong> opened <strong>${escapeHtml(details.documentTitle)}</strong> through your link “${escapeHtml(details.linkLabel)}”.</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(linkUrl)}" style="display:inline-block;padding:12px 20px;background:#176B58;color:#FFFFFF;border-radius:8px;font-weight:600;text-decoration:none">See how they read it</a></p>
<p style="margin:0;color:#4A5460;font-size:14px">${footer}</p>
</div>
</body></html>`;

  return {
    to: details.ownerEmail,
    subject: `“${details.linkLabel}” was just opened`,
    text,
    html,
    idempotencyKey: `first-open-${details.linkId}`,
  };
}

interface FirstViewLike {
  linkId: Types.ObjectId;
  viewerEmail?: string | null;
}

/**
 * Emails the owner unless this link already had its email. Called when a view gets its
 * first reading time. Link.notifiedAt is claimed atomically, so two tabs opening at once
 * send one email; if sending fails the claim is released and the link's next reader
 * triggers the email instead.
 */
export async function notifyFirstOpen(view: FirstViewLike): Promise<void> {
  const claimedAt = new Date();
  const link = await Link.findOneAndUpdate({ _id: view.linkId, notifiedAt: null }, { $set: { notifiedAt: claimedAt } })
    .select({ label: 1, ownerId: 1, documentId: 1 })
    .lean();
  if (!link) return;

  const [owner, doc] = await Promise.all([
    User.findById(link.ownerId, { name: 1, email: 1 }).lean(),
    DocumentModel.findById(link.documentId, { title: 1 }).lean(),
  ]);
  if (!owner || !doc) return;

  try {
    await mailer.send(
      firstOpenEmail({
        ownerName: owner.name,
        ownerEmail: owner.email,
        linkId: link._id.toString(),
        linkLabel: link.label,
        documentTitle: doc.title,
        viewerEmail: view.viewerEmail ?? null,
      }),
    );
  } catch (error) {
    await Link.updateOne({ _id: link._id, notifiedAt: claimedAt }, { $set: { notifiedAt: null } });
    throw error;
  }
}

/* The heartbeat answers straight away and the email goes out in the background. */

const pending = new Set<Promise<void>>();

export function queueFirstOpenEmail(view: FirstViewLike): void {
  const task: Promise<void> = notifyFirstOpen(view)
    .catch((error: unknown) => console.error('Could not send the first-open email:', error))
    .finally(() => pending.delete(task));
  pending.add(task);
}

/** Waits for queued emails: used by tests and on shutdown. */
export async function settleFirstOpenEmails(): Promise<void> {
  await Promise.all([...pending]);
}
