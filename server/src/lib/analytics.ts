import { Types } from 'mongoose';
import {
  analyticsHeadline,
  heatOpacity,
  type AnalyticsRange,
  type AnalyticsStats,
  type LatestLinkView,
  type LinkViewsResponse,
  type NotOpenedLinks,
  type PageStat,
  type RecentView,
} from '@tracked-links/shared';
import { Link } from '../models/Link';
import { View } from '../models/View';
import { HttpError } from './httpError';
import type { LinkViewStats } from './links';
import { countedViewFilter } from './views';

/*
 * Analytics queries. Every number comes from View records that count (some active
 * reading time, not a bot); the rules are in README "How the numbers are worked out".
 */

const DAY_MS = 86_400_000;
const RANGE_DAYS: Record<Exclude<AnalyticsRange, 'all'>, number> = { '30d': 30, '7d': 7 };

/** Start of the reporting period, or null for all time. */
export function rangeStart(range: AnalyticsRange, now = new Date()): Date | null {
  return range === 'all' ? null : new Date(now.getTime() - RANGE_DAYS[range] * DAY_MS);
}

/** One reader: the email they gave, otherwise their hashed network address. */
const viewerKey = { $ifNull: ['$viewerEmail', '$ipHash'] };

/** The page count of the version a view read: its `pages` has one slot per page. */
const viewPageCount = { $max: [{ $size: '$pages' }, 1] };

/** The view reached the last page of the version it read. */
const readToTheEnd = { $expr: { $gte: ['$maxPageReached', viewPageCount] } };

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Counted views, average reading time and the latest view, per link. */
export async function loadLinkStats(linkIds: Types.ObjectId[]): Promise<Map<string, LinkViewStats>> {
  const stats = new Map<string, LinkViewStats>();
  if (linkIds.length === 0) return stats;
  const rows = await View.aggregate<{
    _id: Types.ObjectId;
    views: number;
    avgReadMs: number;
    lastViewedAt: Date;
    latestMaxPage: number;
    latestPageCount: number;
  }>([
    { $match: { linkId: { $in: linkIds }, ...countedViewFilter } },
    { $sort: { startedAt: -1 } },
    {
      $group: {
        _id: '$linkId',
        views: { $sum: 1 },
        avgReadMs: { $avg: '$totalDurationMs' },
        lastViewedAt: { $first: '$startedAt' },
        latestMaxPage: { $first: '$maxPageReached' },
        latestPageCount: { $first: viewPageCount },
      },
    },
  ]);
  for (const row of rows) {
    stats.set(row._id.toString(), {
      views: row.views,
      avgReadMs: Math.round(row.avgReadMs),
      lastViewedAt: row.lastViewedAt,
      latestMaxPage: row.latestMaxPage,
      latestPageCount: row.latestPageCount,
    });
  }
  return stats;
}

/** The Link views screen's extra numbers: readers, views that reached the end, and the latest view. */
export async function loadLinkDetail(linkId: Types.ObjectId) {
  const match = { linkId, ...countedViewFilter };
  const [unique, reachedLastPage, latest] = await Promise.all([
    View.aggregate<{ count: number }>([{ $match: match }, { $group: { _id: viewerKey } }, { $count: 'count' }]),
    View.countDocuments({ ...match, ...readToTheEnd }),
    View.findOne(match, { startedAt: 1, viewerEmail: 1, maxPageReached: 1, pageCount: viewPageCount })
      .sort({ startedAt: -1 })
      .lean<{ startedAt: Date; viewerEmail?: string | null; maxPageReached: number; pageCount: number }>(),
  ]);
  const latestView: LatestLinkView | null = latest
    ? {
        at: latest.startedAt.toISOString(),
        viewerEmail: latest.viewerEmail ?? null,
        maxPageReached: latest.maxPageReached,
        pageCount: latest.pageCount,
      }
    : null;
  return { uniqueViewers: unique[0]?.count ?? 0, reachedLastPage, latestView };
}

interface ReadingFacets {
  totals: Array<{ views: number; avgReadMs: number }>;
  viewers: Array<{ count: number }>;
  /** How many views stopped at each furthest page. */
  reached: Array<{ _id: number; count: number }>;
  /** Views that reached the last page of the version they read. */
  finished: Array<{ count: number }>;
  /** Active time per page, summed over the views. */
  pageTime: Array<{ _id: number; ms: number }>;
}

/** Turns the aggregate's groups into the analytics screen's numbers. */
function summarizeReading(facets: ReadingFacets | undefined, pageCount: number) {
  const totals = facets?.totals[0];
  const views = totals?.views ?? 0;

  // reachedAtLeast[p]: views whose furthest page is p or later, for the page reach bars. A view
  // of a longer, since-replaced file counts as reaching the current last page.
  const reachedAtLeast = new Array<number>(pageCount + 2).fill(0);
  for (const row of facets?.reached ?? []) {
    const page = Math.min(Math.max(row._id, 1), pageCount);
    reachedAtLeast[page]! += row.count;
  }
  for (let page = pageCount - 1; page >= 1; page -= 1) reachedAtLeast[page]! += reachedAtLeast[page + 1]!;

  const timeOnPage = new Map((facets?.pageTime ?? []).map((row) => [row._id, row.ms]));
  const pages: PageStat[] = Array.from({ length: pageCount }, (_, index) => {
    const page = index + 1;
    const reached = reachedAtLeast[page]!;
    const avgMs = reached > 0 ? Math.round((timeOnPage.get(page) ?? 0) / reached) : null;
    return {
      page,
      avgMs,
      reach: views > 0 ? round3(reached / views) : 0,
      heat: heatOpacity((avgMs ?? 0) / 1000),
    };
  });

  const stats: AnalyticsStats = {
    views,
    uniqueViewers: facets?.viewers[0]?.count ?? 0,
    avgReadMs: totals ? Math.round(totals.avgReadMs) : null,
    // Each view against the version it read, so a full read of a since-replaced file still counts.
    reachedLastPage: views > 0 ? round3((facets?.finished[0]?.count ?? 0) / views) : null,
  };
  return { stats, pages, headline: analyticsHeadline(views, pages) };
}

/** Stats, per-page time and reach, and the headline for one document over a period. One query. */
export async function loadDocumentReading(documentId: Types.ObjectId, pageCount: number, range: AnalyticsRange) {
  const since = rangeStart(range);
  const [facets] = await View.aggregate<ReadingFacets>([
    { $match: { documentId, ...countedViewFilter, ...(since ? { startedAt: { $gte: since } } : {}) } },
    {
      $facet: {
        totals: [{ $group: { _id: null, views: { $sum: 1 }, avgReadMs: { $avg: '$totalDurationMs' } } }],
        viewers: [{ $group: { _id: viewerKey } }, { $count: 'count' }],
        reached: [{ $group: { _id: '$maxPageReached', count: { $sum: 1 } } }],
        finished: [{ $match: readToTheEnd }, { $count: 'count' }],
        pageTime: [{ $unwind: '$pages' }, { $group: { _id: '$pages.page', ms: { $sum: '$pages.durationMs' } } }],
      },
    },
  ]);
  return summarizeReading(facets, pageCount);
}

export const RECENT_VIEWS_LIMIT = 5;

interface ViewWithPageCount {
  _id: Types.ObjectId;
  startedAt: Date;
  viewerEmail?: string | null;
  totalDurationMs: number;
  maxPageReached: number;
  pageCount: number;
}

/** The latest views of a document across its links, newest first. */
export async function loadRecentViews(documentId: Types.ObjectId, linkLabels: Map<string, string>): Promise<RecentView[]> {
  const rows = await View.find(
    { documentId, ...countedViewFilter },
    { linkId: 1, viewerEmail: 1, startedAt: 1, totalDurationMs: 1, maxPageReached: 1, pageCount: viewPageCount },
  )
    .sort({ startedAt: -1 })
    .limit(RECENT_VIEWS_LIMIT)
    .lean<Array<ViewWithPageCount & { linkId: Types.ObjectId }>>();
  return rows.map((row) => ({
    id: row._id.toString(),
    linkId: row.linkId.toString(),
    linkLabel: linkLabels.get(row.linkId.toString()) ?? 'Deleted link',
    viewerEmail: row.viewerEmail ?? null,
    startedAt: row.startedAt.toISOString(),
    totalDurationMs: row.totalDurationMs,
    maxPageReached: row.maxPageReached,
    pageCount: row.pageCount,
  }));
}

/* Link views pagination: an opaque cursor of the last row's start time and id. */

const BAD_CURSOR = 'This list is out of date. Reload the page to see the latest views.';

function encodeCursor(view: { _id: Types.ObjectId; startedAt: Date }): string {
  return Buffer.from(`${view.startedAt.getTime()}.${view._id.toString()}`).toString('base64url');
}

function decodeCursor(cursor: string): { at: Date; id: Types.ObjectId } {
  const [time, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('.');
  const at = new Date(Number(time));
  if (!id || !/^[a-f0-9]{24}$/i.test(id) || !time || Number.isNaN(at.getTime())) {
    throw new HttpError(400, BAD_CURSOR, { code: 'invalid_cursor' });
  }
  return { at, id: new Types.ObjectId(id) };
}

/** One page of a link's views, newest first. */
export async function loadLinkViews(
  linkId: Types.ObjectId,
  { cursor, limit }: { cursor?: string; limit: number },
): Promise<LinkViewsResponse> {
  const match = { linkId, ...countedViewFilter };
  const after = cursor ? decodeCursor(cursor) : null;
  const filter = after
    ? { ...match, $or: [{ startedAt: { $lt: after.at } }, { startedAt: after.at, _id: { $lt: after.id } }] }
    : match;

  const [rows, total] = await Promise.all([
    View.find(filter, {
      startedAt: 1,
      viewerEmail: 1,
      totalDurationMs: 1,
      maxPageReached: 1,
      device: 1,
      browser: 1,
      os: 1,
      pageCount: viewPageCount,
    })
      .sort({ startedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean<Array<ViewWithPageCount & { device?: string | null; browser?: string | null; os?: string | null }>>(),
    View.countDocuments(match),
  ]);

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    views: page.map((row) => ({
      id: row._id.toString(),
      startedAt: row.startedAt.toISOString(),
      viewerEmail: row.viewerEmail ?? null,
      totalDurationMs: row.totalDurationMs,
      maxPageReached: row.maxPageReached,
      pageCount: row.pageCount,
      device: row.device ?? null,
      browser: row.browser ?? null,
      os: row.os ?? null,
    })),
    nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
    total,
  };
}

/** Active links (on, not expired) nobody has opened, for the Documents nudge. */
export async function loadNotOpened(
  ownerId: string,
  documentTitles: Map<string, string>,
  now = new Date(),
): Promise<NotOpenedLinks | null> {
  const links = await Link.find(
    { ownerId, isActive: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
    { label: 1, createdAt: 1, documentId: 1 },
  )
    .sort({ createdAt: 1 })
    .lean();
  if (links.length === 0) return null;

  const openedIds = await View.distinct('linkId', { linkId: { $in: links.map((link) => link._id) }, ...countedViewFilter });
  const opened = new Set(openedIds.map((id) => id.toString()));
  const waiting = links.filter(
    (link) => !opened.has(link._id.toString()) && documentTitles.has(link.documentId.toString()),
  );
  const oldest = waiting[0];
  if (!oldest) return null;

  return {
    count: waiting.length,
    oldest: {
      linkId: oldest._id.toString(),
      label: oldest.label,
      createdAt: oldest.createdAt.toISOString(),
      documentId: oldest.documentId.toString(),
      documentTitle: documentTitles.get(oldest.documentId.toString())!,
    },
  };
}
