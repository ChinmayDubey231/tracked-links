import { formatSeconds, numberToWords } from './format';
import type { LinkReading, PageStat } from './types';

/** Heat overlay rule from the design: 0.6 * min(avgSeconds, 50) / 50, never below 0.06. */
export const HEAT_MAX_SECONDS = 50;
export const HEAT_MAX_OPACITY = 0.6;
export const HEAT_MIN_OPACITY = 0.06;

export function heatOpacity(avgSeconds: number): number {
  const clamped = Math.min(Math.max(avgSeconds, 0), HEAT_MAX_SECONDS);
  const opacity = (HEAT_MAX_OPACITY * clamped) / HEAT_MAX_SECONDS;
  return Math.round(Math.max(HEAT_MIN_OPACITY, opacity) * 1000) / 1000;
}

/** With fewer views than this, the analytics headline doesn't guess at a pattern. */
export const MIN_VIEWS_FOR_PATTERN = 3;

const wholeSeconds = (ms: number | null) => Math.round((ms ?? 0) / 1000);

/**
 * The Document analytics headline. Finds the largest drop in average time between
 * consecutive pages: "Reading time falls after page two." A page nobody reached counts as 0s.
 */
export function analyticsHeadline(views: number, pages: Array<Pick<PageStat, 'page' | 'avgMs'>>): string {
  if (views < MIN_VIEWS_FOR_PATTERN || pages.length === 0) return 'Not enough views yet to see a pattern.';
  if (pages.length === 1) return `Readers spend ${formatSeconds(pages[0]!.avgMs ?? 0)} on this page on average.`;

  let dropAfter = 0;
  let largestDrop = 0;
  for (let index = 0; index < pages.length - 1; index += 1) {
    // Whole seconds, so a sub-second wobble doesn't count as a drop.
    const drop = wholeSeconds(pages[index]!.avgMs) - wholeSeconds(pages[index + 1]!.avgMs);
    if (drop > largestDrop) {
      largestDrop = drop;
      dropAfter = pages[index]!.page;
    }
  }
  if (dropAfter > 0) return `Reading time falls after page ${numberToWords(dropAfter)}.`;

  // No page gets less time than the one before it: name the page that gets the most.
  const most = pages.reduce((best, page) => (wholeSeconds(page.avgMs) > wholeSeconds(best.avgMs) ? page : best));
  return `Readers spend the most time on page ${numberToWords(most.page)}.`;
}

/**
 * A link's reading status, from its latest view: "Read in full" when that view reached the
 * last page, otherwise "Stopped at page {n}" where n is the furthest page it reached.
 */
export function linkReading(latestMaxPage: number | null | undefined, pageCount: number): LinkReading {
  if (latestMaxPage == null) return { state: 'unopened' };
  if (latestMaxPage >= pageCount) return { state: 'read' };
  return { state: 'stopped', page: Math.max(latestMaxPage, 1) };
}

/** The chip text: "Read in full", "Stopped at page 2", "Not opened". */
export function readingLabel(reading: LinkReading): string {
  switch (reading.state) {
    case 'read':
      return 'Read in full';
    case 'stopped':
      return `Stopped at page ${reading.page}`;
    case 'unopened':
      return 'Not opened';
  }
}
