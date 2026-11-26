import type { ApiErrorBody, DocumentSummary } from '@tracked-links/shared';
import { API_URL } from './config';

const TOKEN_KEY = 'tracked-links:token';

/* Token storage. localStorage can throw in private windows or with blocked site data. */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Without storage the session lasts until the tab closes.
  }
}

/* Lets the auth context know when the API rejects the session. */
type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields: Record<string, string>;

  constructor(status: number, message: string, code?: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const NETWORK_ERROR = "Can't reach Tracked Links right now. Check your internet connection and try again.";

function toApiError(status: number, body: unknown): ApiError {
  const error = (body as Partial<ApiErrorBody> | null)?.error;
  const message = error?.message ?? `The server returned an unexpected error (${status}). Try again in a moment.`;
  return new ApiError(status, message, error?.code, error?.fields);
}

/** Human-readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something unexpected went wrong. Reload the page and try again.';
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send the session token (default true). */
  auth?: boolean;
  signal?: AbortSignal;
}

export async function api<T>(path: string, { method = 'GET', body, auth = true, signal }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, NETWORK_ERROR, 'network');
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && token) {
      setToken(null);
      unauthorizedListeners.forEach((listener) => listener());
    }
    throw toApiError(response.status, data);
  }
  return data as T;
}

export type UploadProgress = (fraction: number) => void;

/** Uploads a new PDF (plus an optional first-page PNG) as a new document. */
export function uploadDocument(file: File, thumbnail: Blob | null, onProgress: UploadProgress): Promise<DocumentSummary> {
  const form = new FormData();
  form.append('title', file.name);
  form.append('file', file, file.name);
  if (thumbnail) form.append('thumbnail', thumbnail, 'thumbnail.png');
  return sendPdfForm('/documents', form, onProgress);
}

/** Replaces an existing document's PDF. The document keeps its title and its links. */
export function replaceDocumentFile(
  documentId: string,
  file: File,
  thumbnail: Blob | null,
  onProgress: UploadProgress,
): Promise<DocumentSummary> {
  const form = new FormData();
  form.append('file', file, file.name);
  if (thumbnail) form.append('thumbnail', thumbnail, 'thumbnail.png');
  return sendPdfForm(`/documents/${encodeURIComponent(documentId)}/replace`, form, onProgress);
}

/** Sends the form with XMLHttpRequest, because fetch does not report upload progress. */
function sendPdfForm(path: string, form: FormData, onProgress: UploadProgress): Promise<DocumentSummary> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}${path}`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.responseType = 'json';

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new ApiError(0, NETWORK_ERROR, 'network'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve((xhr.response as { document: DocumentSummary }).document);
        return;
      }
      if (xhr.status === 401 && token) {
        setToken(null);
        unauthorizedListeners.forEach((listener) => listener());
      }
      reject(toApiError(xhr.status, xhr.response));
    };
    xhr.send(form);
  });
}
