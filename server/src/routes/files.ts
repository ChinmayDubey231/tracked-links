import { Router } from 'express';
import { HttpError, notFound } from '../lib/httpError';
import { LocalStorage, storage } from '../services/storage';
import { isValidStorageKey } from '../services/storage/local';
import { contentDisposition } from '../services/storage/types';

/**
 * Serves files for the local storage driver, only with a valid unexpired
 * signature. With the S3 driver the browser fetches presigned URLs from the
 * bucket directly and this route returns 404.
 */
export const filesRouter = Router();

filesRouter.get('/*key', (req, res, next) => {
  if (!(storage instanceof LocalStorage)) throw notFound('file');

  const param = req.params.key as string | string[];
  const key = Array.isArray(param) ? param.join('/') : param;
  const expires = Number(req.query.exp);
  const signature = typeof req.query.sig === 'string' ? req.query.sig : '';
  const downloadName = typeof req.query.dl === 'string' ? req.query.dl : '';

  if (!isValidStorageKey(key) || !storage.verify(key, expires, downloadName, signature)) {
    throw new HttpError(403, 'This file link has expired. Reload the page to get a fresh one.', {
      code: 'link_expired',
    });
  }

  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', contentDisposition(downloadName ? 'attachment' : 'inline', downloadName || undefined));
  res.sendFile(storage.resolvePath(key), { cacheControl: false, etag: false, lastModified: false }, (error) => {
    if (error && !res.headersSent) next(notFound('file'));
  });
});
