/**
 * The reader's code, with pdf.js. It is large, so it isn't part of the first page load, but
 * starting it alongside the access request (rather than after) saves a wait in a row.
 * Repeated calls share one download.
 */
export const loadReader = () => import('./Reader');

/** Starts the download early. A failure here is ignored: rendering the reader tries again. */
export function preloadReader() {
  loadReader().catch(() => undefined);
}
