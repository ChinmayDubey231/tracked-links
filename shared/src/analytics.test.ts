import { describe, expect, it } from 'vitest';
import { analyticsHeadline, linkReading, readingLabel } from './analytics';

const pages = (...seconds: Array<number | null>) =>
  seconds.map((s, index) => ({ page: index + 1, avgMs: s === null ? null : s * 1000 }));

describe('analyticsHeadline', () => {
  it('names the page after which reading time falls the most', () => {
    expect(analyticsHeadline(23, pages(48, 31, 16, 7))).toBe('Reading time falls after page one.');
    expect(analyticsHeadline(23, pages(40, 38, 10, 7))).toBe('Reading time falls after page two.');
  });

  it('treats a page nobody reached as no time', () => {
    expect(analyticsHeadline(5, pages(20, 30, null))).toBe('Reading time falls after page two.');
  });

  it('waits for three views before calling a pattern', () => {
    expect(analyticsHeadline(0, pages(0, 0))).toBe('Not enough views yet to see a pattern.');
    expect(analyticsHeadline(2, pages(48, 7))).toBe('Not enough views yet to see a pattern.');
  });

  it('names the busiest page when time never falls', () => {
    expect(analyticsHeadline(4, pages(10, 20, 30))).toBe('Readers spend the most time on page three.');
    // A sub-second difference is not a drop.
    expect(analyticsHeadline(4, [{ page: 1, avgMs: 12_400 }, { page: 2, avgMs: 12_100 }])).toBe(
      'Readers spend the most time on page one.',
    );
  });

  it('describes a one-page document without comparing pages', () => {
    expect(analyticsHeadline(3, pages(38))).toBe('Readers spend 38s on this page on average.');
  });
});

describe('linkReading', () => {
  it('reads the latest view against the page count', () => {
    expect(linkReading(null, 4)).toEqual({ state: 'unopened' });
    expect(linkReading(4, 4)).toEqual({ state: 'read' });
    expect(linkReading(5, 4)).toEqual({ state: 'read' });
    expect(linkReading(2, 4)).toEqual({ state: 'stopped', page: 2 });
  });

  it('labels each state as the chips do', () => {
    expect(readingLabel({ state: 'read' })).toBe('Read in full');
    expect(readingLabel({ state: 'stopped', page: 2 })).toBe('Stopped at page 2');
    expect(readingLabel({ state: 'unopened' })).toBe('Not opened');
  });
});
