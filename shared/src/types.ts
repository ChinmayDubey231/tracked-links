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
