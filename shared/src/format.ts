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

/** "11:42" in local time, 24-hour, as in the design. */
export function clockTime(value: DateInput): string {
  const date = toDate(value);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** When a view opened, for tables: "Today, 11:42", "Yesterday, 18:30", "9 Nov, 14:05". */
export function openedAt(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);
  const days = calendarDaysBetween(date, now);
  const time = clockTime(date);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${formatDate(date, { withYear: date.getFullYear() !== now.getFullYear() })}, ${time}`;
}

/** openedAt() inside a sentence: "today at 11:42", "yesterday at 18:30", "on 9 Nov at 14:05". */
export function dayAndTime(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);
  const days = calendarDaysBetween(date, now);
  const time = clockTime(date);
  if (days === 0) return `today at ${time}`;
  if (days === 1) return `yesterday at ${time}`;
  return `on ${formatDate(date, { withYear: date.getFullYear() !== now.getFullYear() })} at ${time}`;
}

/** The Recent views list: "today 11:42", "yesterday", "3 days ago", "28 Oct". */
export function recentWhen(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);
  if (calendarDaysBetween(date, now) === 0) return `today ${clockTime(date)}`;
  const relative = relativeTime(date, now);
  return relative === 'Yesterday' ? 'yesterday' : relative;
}

/** How much of the document a view covered: "all 4 pages", "3 of 4 pages", "1 page". */
export function pagesReadPhrase(reached: number, total: number): string {
  if (total <= 1) return '1 page';
  if (reached >= total) return `all ${total} pages`;
  return `${Math.max(reached, 1)} of ${total} pages`;
}

/** "Latest view: priya.s@example.com read all 4 pages today at 11:42." */
export function latestViewSentence(
  view: { at: DateInput; viewerEmail: string | null; maxPageReached: number },
  pageCount: number,
  now: Date = new Date(),
): string {
  const who = view.viewerEmail ?? 'Someone';
  return `Latest view: ${who} read ${pagesReadPhrase(view.maxPageReached, pageCount)} ${dayAndTime(view.at, now)}.`;
}

/** Wait a day after sending before suggesting a follow-up. */
function dueForFollowUp(sentAt: DateInput, now: Date): boolean {
  return now.getTime() - toDate(sentAt).getTime() >= DAY;
}

/**
 * Detail line for a link nobody has opened: "Sent 3 days ago. Time for a follow-up?"
 * On the day it was made: "Sent 2 hours ago. No one has opened it yet."
 */
export function notOpenedDetail(createdAt: DateInput, now: Date = new Date()): string {
  const sent = `Sent ${relativeTimeInSentence(createdAt, now)}.`;
  return dueForFollowUp(createdAt, now) ? `${sent} Time for a follow-up?` : `${sent} No one has opened it yet.`;
}

/**
 * The Documents nudge card: "1 link hasn’t been opened yet" /
 * "Accenture application, on Resume and projects.pdf, was sent 3 days ago. Time for a follow-up?"
 */
export function notOpenedNudge(
  notOpened: { count: number; oldest: { label: string; documentTitle: string; createdAt: DateInput } },
  now: Date = new Date(),
) {
  const { count, oldest } = notOpened;
  const title = `${countLabel(count, 'link')} ${count === 1 ? 'hasn’t' : 'haven’t'} been opened yet`;
  const sent = `was sent ${relativeTimeInSentence(oldest.createdAt, now)}.`;
  const followUp = dueForFollowUp(oldest.createdAt, now) ? ' Time for a follow-up?' : '';
  const detail =
    count === 1
      ? `${oldest.label}, on ${oldest.documentTitle}, ${sent}${followUp}`
      : `The oldest, ${oldest.label} on ${oldest.documentTitle}, ${sent}${followUp}`;
  return { title, detail };
}

/** "Desktop, Chrome, Windows", leaving out whatever wasn't recognised. */
export function deviceLabel(view: { device: string | null; browser: string | null; os: string | null }): string {
  const parts = [view.device, view.browser, view.os].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Unknown device';
}

/** "61%". */
export function formatPercent(fraction: number | null | undefined): string {
  if (fraction == null || !Number.isFinite(fraction)) return '—';
  return `${Math.round(fraction * 100)}%`;
}

/**
 * One-line summary of a link's settings, as on the Link views screen:
 * "Email required, no password, download off, expires 30 Nov 2026."
 */
export function linkSettingsSummary(link: {
  requireEmail: boolean;
  hasPassword: boolean;
  allowDownload: boolean;
  expiresAt: DateInput | null;
}): string {
  const parts = [
    link.requireEmail ? 'Email required' : 'No email needed',
    link.hasPassword ? 'password set' : 'no password',
    link.allowDownload ? 'download on' : 'download off',
    link.expiresAt ? `expires ${formatDate(link.expiresAt)}` : 'no expiry date',
  ];
  return `${parts.join(', ')}.`;
}

/** The ISO instant at the end of a "YYYY-MM-DD" day in local time, or null for an empty value. */
export function endOfDayIso(day: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** "YYYY-MM-DD" in local time, for a date input's value. */
export function toDateInputValue(value: DateInput): string {
  const date = toDate(value);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
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
