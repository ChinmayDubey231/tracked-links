/** An error whose message is safe to show to the person using the app. */
export class HttpError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields?: Record<string, string>;

  constructor(status: number, message: string, options: { code?: string; fields?: Record<string, string> } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = options.code;
    this.fields = options.fields;
  }
}

export const notFound = (what = 'page') =>
  new HttpError(404, `We couldn't find that ${what}. It may have been deleted.`, { code: 'not_found' });
