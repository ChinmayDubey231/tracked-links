import { describe, expect, it } from 'vitest';
import {
  countPhrase,
  documentsHeadline,
  endOfDayIso,
  formatBytes,
  formatDate,
  formatDuration,
  formatSeconds,
  linkSettingsSummary,
  numberToWords,
  relativeTime,
  toDateInputValue,
} from './format';
import { heatOpacity } from './analytics';

describe('numberToWords', () => {
  it('spells out 0 to 99', () => {
    expect(numberToWords(0)).toBe('zero');
    expect(numberToWords(3)).toBe('three');
    expect(numberToWords(19)).toBe('nineteen');
    expect(numberToWords(20)).toBe('twenty');
    expect(numberToWords(35)).toBe('thirty-five');
    expect(numberToWords(99)).toBe('ninety-nine');
  });

  it('keeps larger numbers as digits', () => {
    expect(numberToWords(100)).toBe('100');
    expect(numberToWords(1240)).toBe('1,240');
  });
});

describe('countPhrase', () => {
  it('handles zero, one and many', () => {
    expect(countPhrase(0, 'view')).toBe('no views');
    expect(countPhrase(1, 'view')).toBe('one view');
    expect(countPhrase(35, 'view')).toBe('thirty-five views');
    expect(countPhrase(2, 'person', 'people')).toBe('two people');
  });
});

describe('formatDuration', () => {
  it('matches the design format', () => {
    expect(formatDuration(102_000)).toBe('1m 42s');
    expect(formatDuration(38_000)).toBe('0m 38s');
    expect(formatDuration(185_000)).toBe('3m 05s');
    expect(formatDuration(3_900_000)).toBe('1h 05m');
  });

  it('shows a dash for missing values', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
  });

  it('formats short per-page times in seconds', () => {
    expect(formatSeconds(48_000)).toBe('48s');
    expect(formatSeconds(75_000)).toBe('1m 15s');
  });
});

describe('formatBytes', () => {
  it('uses KB and MB', () => {
    expect(formatBytes(412 * 1024)).toBe('412 KB');
    expect(formatBytes(2.4 * 1024 * 1024)).toBe('2.4 MB');
  });
});

describe('relativeTime', () => {
  const now = new Date(2026, 10, 12, 14, 0, 0); // 12 Nov 2026, 14:00 local

  it('says just now under a minute', () => {
    expect(relativeTime(new Date(2026, 10, 12, 13, 59, 30), now)).toBe('just now');
  });

  it('uses minutes and hours on the same day', () => {
    expect(relativeTime(new Date(2026, 10, 12, 13, 55), now)).toBe('5 minutes ago');
    expect(relativeTime(new Date(2026, 10, 12, 12, 0), now)).toBe('2 hours ago');
  });

  it('says Yesterday for the previous calendar day', () => {
    expect(relativeTime(new Date(2026, 10, 11, 9, 0), now)).toBe('Yesterday');
  });

  it('keeps hours for late last night', () => {
    const lateNow = new Date(2026, 10, 12, 1, 0);
    expect(relativeTime(new Date(2026, 10, 11, 23, 0), lateNow)).toBe('2 hours ago');
  });

  it('uses days within a week, then dates', () => {
    expect(relativeTime(new Date(2026, 10, 8, 10, 0), now)).toBe('4 days ago');
    expect(relativeTime(new Date(2026, 9, 28, 10, 0), now)).toBe('28 Oct');
    expect(relativeTime(new Date(2025, 9, 28, 10, 0), now)).toBe('28 Oct 2025');
  });
});

describe('formatDate', () => {
  it('formats with and without the year', () => {
    expect(formatDate(new Date(2026, 10, 2))).toBe('2 Nov 2026');
    expect(formatDate(new Date(2026, 9, 28), { withYear: false })).toBe('28 Oct');
  });
});

describe('documentsHeadline', () => {
  const now = new Date(2026, 10, 12, 14, 0);

  it('matches the design sentence', () => {
    const result = documentsHeadline(
      {
        documents: 3,
        views: 35,
        latestView: { at: new Date(2026, 10, 12, 12, 0), documentTitle: 'Resume and projects.pdf' },
      },
      now,
    );
    expect(result.title).toBe('Three documents, thirty-five views.');
    expect(result.subtitle).toBe('The latest view was 2 hours ago, on Resume and projects.pdf.');
  });

  it('handles a single document with no views', () => {
    const result = documentsHeadline({ documents: 1, views: 0, latestView: null }, now);
    expect(result.title).toBe('One document, no views yet.');
  });

  it('words older views naturally', () => {
    const yesterday = documentsHeadline(
      { documents: 2, views: 1, latestView: { at: new Date(2026, 10, 11, 9, 0), documentTitle: 'CV.pdf' } },
      now,
    );
    expect(yesterday.subtitle).toBe('The latest view was yesterday, on CV.pdf.');

    const older = documentsHeadline(
      { documents: 2, views: 1, latestView: { at: new Date(2026, 9, 28, 9, 0), documentTitle: 'CV.pdf' } },
      now,
    );
    expect(older.subtitle).toBe('The latest view was on 28 Oct, for CV.pdf.');
  });
});

describe('linkSettingsSummary', () => {
  it('matches the Link views sentence', () => {
    expect(
      linkSettingsSummary({
        requireEmail: true,
        hasPassword: false,
        allowDownload: false,
        expiresAt: new Date(2026, 10, 30, 23, 59),
      }),
    ).toBe('Email required, no password, download off, expires 30 Nov 2026.');
  });

  it('covers the opposite settings', () => {
    expect(linkSettingsSummary({ requireEmail: false, hasPassword: true, allowDownload: true, expiresAt: null })).toBe(
      'No email needed, password set, download on, no expiry date.',
    );
  });
});

describe('date input helpers', () => {
  it('turns a day into the last moment of that day, in local time', () => {
    const iso = endOfDayIso('2026-11-30');
    const date = new Date(iso!);
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()]).toEqual([
      2026, 10, 30, 23, 59,
    ]);
    expect(toDateInputValue(date)).toBe('2026-11-30');
  });

  it('rejects anything that is not a day', () => {
    expect(endOfDayIso('')).toBeNull();
    expect(endOfDayIso('30/11/2026')).toBeNull();
  });
});

describe('heatOpacity', () => {
  it('follows 0.6 * min(s, 50) / 50 with a 0.06 floor', () => {
    expect(heatOpacity(50)).toBe(0.6);
    expect(heatOpacity(120)).toBe(0.6);
    expect(heatOpacity(25)).toBe(0.3);
    expect(heatOpacity(0)).toBe(0.06);
    expect(heatOpacity(2)).toBe(0.06);
  });
});
