import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@tracked-links/shared';
import { HttpError } from '../lib/httpError';

function send(res: Response, status: number, error: ApiErrorBody['error']) {
  res.status(status).json({ error } satisfies ApiErrorBody);
}

export function notFoundHandler(_req: Request, res: Response) {
  send(res, 404, { message: 'There is nothing at this address.', code: 'not_found' });
}

// Express recognises error handlers by their four arguments, so `_next` must stay.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return send(res, err.status, { message: err.message, code: err.code, fields: err.fields });
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'form';
      fields[key] ??= issue.message;
    }
    const first = Object.values(fields)[0] ?? 'Check the form and try again.';
    return send(res, 400, { message: first, code: 'invalid_input', fields });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return send(res, 413, {
        message: 'This file is larger than 10 MB. Compress the PDF or export a smaller version, then try again.',
        code: 'file_too_large',
      });
    }
    return send(res, 400, { message: 'The upload was not in the expected format. Try again.', code: 'bad_upload' });
  }

  if (err instanceof mongoose.Error.CastError) {
    return send(res, 404, { message: "We couldn't find that item. It may have been deleted.", code: 'not_found' });
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return send(res, 400, { message: 'The request body was not valid JSON.', code: 'invalid_json' });
  }

  const status = (err as { status?: number }).status;
  if (status === 413) {
    return send(res, 413, { message: 'The request was too large.', code: 'payload_too_large' });
  }

  console.error(err);
  return send(res, 500, {
    message: 'Something went wrong on our side. Try again in a moment.',
    code: 'server_error',
  });
}
