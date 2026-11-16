import { config } from '../../config';
import { LocalStorage } from './local';
import { S3Storage } from './s3';
import type { StorageDriver } from './types';

function createStorage(): StorageDriver {
  if (config.storageDriver === 's3' && config.s3) {
    return new S3Storage({ ...config.s3, defaultTtlSeconds: config.SIGNED_URL_TTL_SECONDS });
  }
  return new LocalStorage({
    rootDir: config.LOCAL_STORAGE_DIR,
    apiBaseUrl: config.apiBaseUrl,
    secret: config.JWT_SECRET,
    defaultTtlSeconds: config.SIGNED_URL_TTL_SECONDS,
  });
}

export const storage = createStorage();
export { LocalStorage } from './local';
export type { StorageDriver, SignedUrl } from './types';
