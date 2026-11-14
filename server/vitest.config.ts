import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests share one MongoDB database, so run files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: process.env.MONGODB_URI_TEST ?? 'mongodb://127.0.0.1:27017/tracked-links-test',
      JWT_SECRET: 'test-secret-that-is-long-enough-for-hs256-signing',
      IP_HASH_SALT: 'test-ip-hash-salt-value',
      STORAGE_DRIVER: 'local',
      LOCAL_STORAGE_DIR: './storage-test',
      API_BASE_URL: 'http://localhost:4000',
      CLIENT_ORIGIN: 'http://localhost:5173',
    },
  },
});
