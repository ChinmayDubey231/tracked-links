import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== '' ? value.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required.'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters.'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  IP_HASH_SALT: z.string().min(16, 'IP_HASH_SALT must be at least 16 characters.'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  PUBLIC_BASE_URL: z.string().default('http://localhost:5173'),
  API_BASE_URL: z.string().default('http://localhost:4000'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  STORAGE_DRIVER: optionalString.pipe(z.enum(['local', 's3']).optional()),
  LOCAL_STORAGE_DIR: z.string().default('./storage'),
  S3_ENDPOINT: optionalString,
  S3_REGION: optionalString,
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
  console.error(`Invalid server configuration. Check server/.env:\n${problems.join('\n')}`);
  process.exit(1);
}

const env = parsed.data;

const stripSlash = (url: string) => url.replace(/\/+$/, '');

/**
 * S3-compatible storage (Backblaze B2, Cloudflare R2, AWS S3). The endpoint may be
 * given with or without "https://". When S3_REGION is empty it is read from the
 * endpoint ("s3.us-east-005.backblazeb2.com" gives "us-east-005"), else "auto" (R2).
 */
function readS3Settings() {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;

  const endpoint = stripSlash(/^https?:\/\//i.test(S3_ENDPOINT) ? S3_ENDPOINT : `https://${S3_ENDPOINT}`);
  let host: string;
  try {
    host = new URL(endpoint).hostname;
  } catch {
    console.error(`S3_ENDPOINT is not a valid address: "${S3_ENDPOINT}". Copy the endpoint shown on your bucket's page.`);
    process.exit(1);
  }
  const region = env.S3_REGION ?? /^s3\.([a-z0-9-]+)\./i.exec(host)?.[1] ?? 'auto';
  return { endpoint, region, bucket: S3_BUCKET, accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY };
}

const s3 = readS3Settings();
const storageDriver = env.STORAGE_DRIVER ?? (s3 ? 's3' : 'local');
if (storageDriver === 's3' && !s3) {
  console.error('STORAGE_DRIVER is "s3" but S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY is missing.');
  process.exit(1);
}

export const config = {
  ...env,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  storageDriver,
  s3,
  clientOrigins: env.CLIENT_ORIGIN.split(',').map((origin) => stripSlash(origin.trim())).filter(Boolean),
  publicBaseUrl: stripSlash(env.PUBLIC_BASE_URL),
  apiBaseUrl: stripSlash(env.API_BASE_URL),
} as const;

export type Config = typeof config;
