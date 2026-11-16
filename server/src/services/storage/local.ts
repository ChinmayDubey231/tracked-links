import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SignedUrl, SignedUrlOptions, StorageDriver } from './types';

/** Keys this app generates: "documents/<ownerId>/<id>.pdf" or "thumbnails/<ownerId>/<id>.png". */
const KEY_PATTERN = /^(documents|thumbnails)\/[a-f0-9]{24}\/[A-Za-z0-9_-]{10,64}\.(pdf|png)$/;

export function isValidStorageKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

interface LocalStorageOptions {
  rootDir: string;
  apiBaseUrl: string;
  secret: string;
  defaultTtlSeconds: number;
}

/**
 * Development storage on local disk. Files are served by GET /files/* only with
 * a valid, unexpired HMAC signature, mirroring how S3 presigned URLs behave.
 */
export class LocalStorage implements StorageDriver {
  readonly name = 'local' as const;
  readonly rootDir: string;
  private readonly key: Buffer;

  constructor(private readonly options: LocalStorageOptions) {
    this.rootDir = path.resolve(options.rootDir);
    this.key = createHash('sha256').update(`local-files:${options.secret}`).digest();
  }

  resolvePath(key: string): string {
    if (!isValidStorageKey(key)) throw new Error(`Invalid storage key: ${key}`);
    const full = path.resolve(this.rootDir, key);
    if (!full.startsWith(this.rootDir + path.sep)) throw new Error(`Storage key escapes root: ${key}`);
    return full;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const full = this.resolvePath(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolvePath(key), { force: true });
  }

  sign(key: string, expires: number, downloadName: string): string {
    return createHmac('sha256', this.key).update(`${key}\n${expires}\n${downloadName}`).digest('base64url');
  }

  async signedUrl(key: string, options: SignedUrlOptions = {}): Promise<SignedUrl> {
    const ttl = options.ttlSeconds ?? this.options.defaultTtlSeconds;
    const expires = Math.floor(Date.now() / 1000) + ttl;
    const downloadName = options.downloadName ?? '';
    const params = new URLSearchParams({ exp: String(expires), sig: this.sign(key, expires, downloadName) });
    if (downloadName) params.set('dl', downloadName);
    return {
      url: `${this.options.apiBaseUrl}/files/${key}?${params.toString()}`,
      expiresAt: new Date(expires * 1000),
    };
  }

  /** Returns true when the signature matches and has not expired. */
  verify(key: string, expires: number, downloadName: string, signature: string): boolean {
    if (!Number.isFinite(expires) || expires < Date.now() / 1000) return false;
    const expected = Buffer.from(this.sign(key, expires, downloadName));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
