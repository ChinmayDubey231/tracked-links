/**
 * Text formatting shared by the client and the server. Every function is pure:
 * pass `now` to get stable results in tests.
 */

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Fixed English month names, so output does not depend on the runtime's locale data. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MINUTE = 60_000;
const DAY = 86_400_000;

export type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Spells out whole numbers from 0 to 99 ("thirty-five"); larger numbers stay as digits ("1,240"). */
export function numberToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) return n.toLocaleString('en-GB');
  if (n < 20) return ONES[n]!;
  const tens = TENS[Math.floor(n / 10)]!;
  const ones = n % 10;
  return ones === 0 ? tens : `${tens}-${ONES[ones]}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "three documents", "one view", "no views". */
export function countPhrase(n: number, singular: string, plural = `${singular}s`): string {
  if (n === 0) return `no ${plural}`;
  return `${numberToWords(n)} ${n === 1 ? singular : plural}`;
}

/** "4 pages", "1 link": digits, for secondary text. */
export function countLabel(n: number, singular: string, plural = `${singular}s`): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? singular : plural}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Reading time as "1m 42s", "0m 38s" or "1h 05m". Missing values become an em dash. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${pad2(minutes)}m`;
  return `${minutes}m ${pad2(seconds)}s`;
}

/** Short per-page times: "48s" under a minute, otherwise the same as formatDuration. */
export function formatSeconds(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : formatDuration(ms);
}

/** "412 KB", "2.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** "2 Nov 2026", or "28 Oct" when `withYear` is false. */
export function formatDate(value: DateInput, { withYear = true }: { withYear?: boolean } = {}): string {
  const date = toDate(value);
  const dayMonth = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return withYear ? `${dayMonth} ${date.getFullYear()}` : dayMonth;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole calendar days from `from` to `to` in local time (DST-safe). */
function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY);
}

/**
 * "just now", "5 minutes ago", "2 hours ago", "Yesterday", "4 days ago", then
 * dates like "28 Oct" (with the year when it differs from this year).
 */
export function relativeTime(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return 'just now';

  const minutes = Math.floor(diff / MINUTE);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;

  const hours = Math.floor(minutes / 60);
  const days = calendarDaysBetween(date, now);
  // Late last night still reads better as "2 hours ago" than "Yesterday".
  if (days === 0 || hours < 6) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(date, { withYear: date.getFullYear() !== now.getFullYear() });
}

/** True when relativeTime() fell back to a calendar date. */
function isCalendarDate(relative: string): boolean {
  return /^\d/.test(relative) && !relative.endsWith('ago');
}

/** relativeTime() worded to sit inside a sentence: "yesterday", "on 28 Oct". */
export function relativeTimeInSentence(value: DateInput, now: Date = new Date()): string {
  const relative = relativeTime(value, now);
  if (relative === 'Yesterday') return 'yesterday';
  if (isCalendarDate(relative)) return `on ${relative}`;
  return relative;
}

export interface DocumentsHeadlineInput {
  documents: number;
  views: number;
  latestView: { at: DateInput; documentTitle: string } | null;
}

/**
 * The Documents screen headline:
 * "Three documents, thirty-five views." / "The latest view was 2 hours ago, on Resume.pdf."
 */
export function documentsHeadline(totals: DocumentsHeadlineInput, now: Date = new Date()) {
  const views = totals.views === 0 ? 'no views yet' : countPhrase(totals.views, 'view');
  const title = `${capitalize(countPhrase(totals.documents, 'document'))}, ${views}.`;

  let subtitle: string;
  if (!totals.latestView) {
    subtitle = 'Create a share link and send it. Views show up here as soon as someone opens it.';
  } else {
    const when = relativeTimeInSentence(totals.latestView.at, now);
    const joiner = when.startsWith('on ') ? 'for' : 'on';
    subtitle = `The latest view was ${when}, ${joiner} ${totals.latestView.documentTitle}.`;
  }
  return { title, subtitle };
}
