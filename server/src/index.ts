import { config } from './config';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './db';
import { mailer } from './services/email';

async function main() {
  await connectDatabase(config.MONGODB_URI);

  if (config.isProduction && config.storageDriver === 'local') {
    console.warn('Warning: using local disk storage in production. Files are lost when the server restarts. Set the S3_* variables.');
  }
  if (config.isProduction && mailer.name !== 'resend') {
    console.warn('Warning: RESEND_API_KEY is empty, so first-open emails are printed to the log instead of sent.');
  }

  const server = createApp().listen(config.PORT, () => {
    console.log(`API listening on ${config.apiBaseUrl} (storage: ${config.storageDriver}, email: ${mailer.name})`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down.`);
    server.close(() => {
      disconnectDatabase().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Failed to start the API:', error);
  process.exit(1);
});
