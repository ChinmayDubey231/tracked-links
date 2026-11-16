export interface SignedUrlOptions {
  /** When set, the URL downloads the file under this name instead of displaying it. */
  downloadName?: string;
  /** Overrides SIGNED_URL_TTL_SECONDS. */
  ttlSeconds?: number;
}

export interface SignedUrl {
  url: string;
  expiresAt: Date;
}

/** Private file storage. Files are only ever reachable through short-lived signed URLs. */
export interface StorageDriver {
  readonly name: 'local' | 's3';
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  signedUrl(key: string, options?: SignedUrlOptions): Promise<SignedUrl>;
  remove(key: string): Promise<void>;
}

export function contentDisposition(type: 'inline' | 'attachment', fileName?: string): string {
  if (!fileName) return type;
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
