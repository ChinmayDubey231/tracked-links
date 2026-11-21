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

export interface DocumentsResponse {
  documents: DocumentSummary[];
  totals: DocumentsTotals;
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

export interface LinkDetailResponse {
  link: LinkSummary;
  document: { id: string; title: string; pageCount: number };
  /** Distinct viewer emails where given, otherwise distinct network address hashes. */
  uniqueViewers: number;
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
