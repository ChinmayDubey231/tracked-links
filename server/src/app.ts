import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './routes/auth';
import { documentsRouter } from './routes/documents';
import { filesRouter } from './routes/files';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (config.TRUST_PROXY > 0) app.set('trust proxy', config.TRUST_PROXY);

  app.use(helmet());
  app.use(
    cors({
      origin: config.clientOrigins,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  /** Used by the keep-alive ping so the Render instance never sleeps. */
  app.get('/health', (_req, res) => {
    res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
  });

  app.use('/auth', authRouter);
  app.use('/documents', documentsRouter);
  app.use('/files', filesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
