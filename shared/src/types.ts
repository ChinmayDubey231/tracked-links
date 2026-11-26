/**
 * Shapes of the JSON the API sends and receives. Dates travel as ISO strings.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_THUMBNAIL_BYTES = 1024 * 1024;
export const MIN_PASSWORD_LENGTH = 8;
/** bcrypt only looks at the first 72 bytes of a password. */
export const MAX_PASSWORD_BYTES = 72;

export interface ApiErrorBody {
  error: {
    message: string;
    code?: string;
    /** Per-field messages for form validation errors, keyed by field name. */
    fields?: Record<string, string>;
  };
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface MeResponse {
  user: PublicUser;
}

export interface DocumentSummary {
  id: string;
  title: string;
  pageCount: number;
  sizeBytes: number;
  version: number;
  createdAt: string;
  replacedAt: string | null;
  linkCount: number;
  /** Views with more than zero active reading time. */
  views: number;
  /** Mean total reading time across those views, or null with no views. */
  avgReadMs: number | null;
  lastViewedAt: string | null;
  /** Short-lived signed URL of the first-page image, when one was uploaded. */
  thumbnailUrl: string | null;
}

export interface LatestView {
  at: string;
  documentId: string;
  documentTitle: string;
}

export interface DocumentsTotals {
  documents: number;
  views: number;
  latestView: LatestView | null;
}

export interface NotOpenedLinks {
  /** Active links (on, not expired) that nobody has opened yet. */
  count: number;
  /** The one sent longest ago: the Documents nudge names it. */
  oldest: {
    linkId: string;
    label: string;
    createdAt: string;
    documentId: string;
    documentTitle: string;
  };
}

export interface DocumentsResponse {
  documents: DocumentSummary[];
  totals: DocumentsTotals;
  /** Null when every active link has been opened (or there are none). */
  notOpened: NotOpenedLinks | null;
}

export interface DocumentResponse {
  document: DocumentSummary;
}

export interface SignedFileResponse {
  url: string;
  expiresAt: string;
}

/* Links */

/** Link passwords: short enough to send alongside the link, long enough not to be guessed at once. */
export const MIN_LINK_PASSWORD_LENGTH = 6;
export const MAX_LINK_LABEL_LENGTH = 80;

/** active: anyone with the URL can open it. expired: past its expiry date. off: switched off by the owner. */
export type LinkStatus = 'active' | 'expired' | 'off';

/**
 * How far the link's latest reader got. read: the latest view reached the last page.
 * stopped: it ended before the last page, at `page`. unopened: no views yet.
 */
export type LinkReading = { state: 'read' } | { state: 'stopped'; page: number } | { state: 'unopened' };

export interface LinkSummary {
  id: string;
  documentId: string;
  slug: string;
  label: string;
  requireEmail: boolean;
  /** The password itself is never sent back, only whether one is set. */
  hasPassword: boolean;
  allowDownload: boolean;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  status: LinkStatus;
  /** Views with more than zero active reading time. */
  views: number;
  lastViewedAt: string | null;
  /** Mean active reading time across those views, or null with no views. */
  avgReadMs: number | null;
  reading: LinkReading;
}

export interface LinkInput {
  label: string;
  requireEmail: boolean;
  /**
   * Create: the password, or null for none.
   * Update: a new password, null to remove it, or leave it out to keep the current one.
   */
  password?: string | null;
  allowDownload: boolean;
  /** An instant (ISO string), normally the end of the chosen day in the owner's time zone; null for no expiry. */
  expiresAt: string | null;
}

export type LinkUpdate = Partial<LinkInput> & { isActive?: boolean };

export interface LinkResponse {
  link: LinkSummary;
}

export interface LinksResponse {
  links: LinkSummary[];
}

export interface LatestLinkView {
  at: string;
  viewerEmail: string | null;
  maxPageReached: number;
  /** Pages in the version this view read; differs from the document's after a replace. */
  pageCount: number;
}

export interface LinkDetailResponse {
  link: LinkSummary;
  document: { id: string; title: string; pageCount: number };
  /** Distinct viewer emails where given, otherwise distinct network address hashes. */
  uniqueViewers: number;
  /** Views that reached the document's last page. */
  reachedLastPage: number;
  /** The most recent view, for the "Latest view" line. Null until someone opens the link. */
  latestView: LatestLinkView | null;
}

/** One row of the Link views table. */
export interface ViewRow {
  id: string;
  startedAt: string;
  viewerEmail: string | null;
  totalDurationMs: number;
  maxPageReached: number;
  /** Pages in the version this view read. */
  pageCount: number;
  device: string | null;
  browser: string | null;
  os: string | null;
}

export const VIEWS_PAGE_SIZE = 20;
export const MAX_VIEWS_PAGE_SIZE = 50;

export interface LinkViewsResponse {
  /** Newest first. */
  views: ViewRow[];
  /** Send as ?cursor= for the next page; null on the last page. */
  nextCursor: string | null;
  /** All counted views of the link, for "Showing 6 of 9 views". */
  total: number;
}

/* Document analytics */

export const ANALYTICS_RANGES = ['all', '30d', '7d'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export interface PageStat {
  page: number;
  /** Mean active time on the page across the views that reached it; null when none did. */
  avgMs: number | null;
  /** Share of views that reached the page, 0 to 1. */
  reach: number;
  /** Heat overlay opacity, from heatOpacity(). */
  heat: number;
}

export interface AnalyticsStats {
  views: number;
  uniqueViewers: number;
  avgReadMs: number | null;
  /** Share of views that reached the last page, 0 to 1; null with no views. */
  reachedLastPage: number | null;
}

export interface RecentView {
  id: string;
  linkId: string;
  linkLabel: string;
  viewerEmail: string | null;
  startedAt: string;
  totalDurationMs: number;
  maxPageReached: number;
  /** Pages in the version this view read. */
  pageCount: number;
}

export interface DocumentAnalyticsResponse {
  document: DocumentSummary;
  range: AnalyticsRange;
  /** "Reading time falls after page two." Computed from `stats` and `pages`. */
  headline: string;
  /** Views in the chosen range. */
  stats: AnalyticsStats;
  /** One entry per page, from views in the chosen range. */
  pages: PageStat[];
  /** Every link of the document, newest first, with all-time numbers (as on each Link screen). */
  links: LinkSummary[];
  /** The latest views across all links, newest first, regardless of range. */
  recentViews: RecentView[];
}

/* Public viewer */

export interface PublicLinkResponse {
  title: string;
  pageCount: number;
  ownerName: string;
  requireEmail: boolean;
  requirePassword: boolean;
}

export interface AccessRequest {
  email?: string;
  password?: string;
}

export interface AccessResponse {
  /** Null when the signed-in owner opens their own link: nothing is recorded. */
  view: { id: string; token: string } | null;
  title: string;
  pageCount: number;
  allowDownload: boolean;
  /** Short-lived signed URL of the PDF. Load it straight away. */
  file: SignedFileResponse;
}

export interface PageTime {
  page: number;
  ms: number;
}

/**
 * Sent every few seconds while the document is open, and once more with
 * navigator.sendBeacon when the tab closes. Times are added since the last heartbeat.
 */
export interface HeartbeatRequest {
  token: string;
  pages: PageTime[];
  /** The furthest page the reader has had on screen. */
  maxPage: number;
}

export interface DownloadRequest {
  token: string;
}
