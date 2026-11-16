import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { contentDisposition, type SignedUrl, type SignedUrlOptions, type StorageDriver } from './types';

interface S3Options {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  defaultTtlSeconds: number;
}

/**
 * A private bucket on any S3-compatible service: Backblaze B2, Cloudflare R2 or AWS S3.
 * The bucket must stay private; files are only reachable through presigned URLs.
 */
export class S3Storage implements StorageDriver {
  readonly name = 's3' as const;
  private readonly client: S3Client;

  constructor(private readonly options: S3Options) {
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
      // Recent SDK versions add CRC checksums to every request by default, which
      // B2 and R2 can reject. Only send them when an operation requires them.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.options.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async signedUrl(key: string, options: SignedUrlOptions = {}): Promise<SignedUrl> {
    const ttl = options.ttlSeconds ?? this.options.defaultTtlSeconds;
    const command = new GetObjectCommand({
      Bucket: this.options.bucket,
      Key: key,
      ResponseContentDisposition: options.downloadName
        ? contentDisposition('attachment', options.downloadName)
        : undefined,
      ResponseCacheControl: 'private, no-store',
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: ttl });
    return { url, expiresAt: new Date(Date.now() + ttl * 1000) };
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }));
  }
}
