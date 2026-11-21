import { customAlphabet } from 'nanoid';
import type { Types } from 'mongoose';
import type { LinkStatus, LinkSummary } from '@tracked-links/shared';

/** Letters and digits only, so a slug survives being typed, pasted into chat or read aloud. */
const SLUG_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
/** 62^10 is about 8 × 10^17 slugs: not guessable, per the spec's "at least 10 random characters". */
export const SLUG_LENGTH = 10;
export const newSlug = customAlphabet(SLUG_ALPHABET, SLUG_LENGTH);

export const SLUG_PATTERN = /^[A-Za-z0-9_-]{10,64}$/;

export interface LinkLike {
  _id: Types.ObjectId;
  documentId: Types.ObjectId;
  slug: string;
  label: string;
  requireEmail?: boolean | null;
  passwordHash?: string | null;
  allowDownload?: boolean | null;
  isActive?: boolean | null;
  expiresAt?: Date | null;
  createdAt: Date;
}

/** Switched off wins over expired: the owner's choice is the more recent fact. */
export function linkStatus(link: Pick<LinkLike, 'isActive' | 'expiresAt'>, now = new Date()): LinkStatus {
  if (link.isActive === false) return 'off';
  if (link.expiresAt && link.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'active';
}

export interface LinkViewStats {
  views: number;
  lastViewedAt: Date | null;
}

export function serializeLink(link: LinkLike, stats: LinkViewStats = { views: 0, lastViewedAt: null }): LinkSummary {
  return {
    id: link._id.toString(),
    documentId: link.documentId.toString(),
    slug: link.slug,
    label: link.label,
    requireEmail: Boolean(link.requireEmail),
    hasPassword: Boolean(link.passwordHash),
    allowDownload: Boolean(link.allowDownload),
    isActive: link.isActive !== false,
    expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
    createdAt: link.createdAt.toISOString(),
    status: linkStatus(link),
    views: stats.views,
    lastViewedAt: stats.lastViewedAt ? stats.lastViewedAt.toISOString() : null,
  };
}
