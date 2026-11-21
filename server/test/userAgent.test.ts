import { describe, expect, it } from 'vitest';
import { parseUserAgent } from '../src/lib/userAgent';

describe('parseUserAgent', () => {
  it.each([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      { device: 'Desktop', browser: 'Chrome', os: 'Windows' },
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      { device: 'Desktop', browser: 'Edge', os: 'Windows' },
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
      { device: 'Desktop', browser: 'Safari', os: 'macOS' },
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
      { device: 'Mobile', browser: 'Safari', os: 'iOS' },
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
      { device: 'Mobile', browser: 'Chrome', os: 'iOS' },
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      { device: 'Mobile', browser: 'Chrome', os: 'Android' },
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Safari/537.36',
      { device: 'Tablet', browser: 'Samsung Internet', os: 'Android' },
    ],
    [
      'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
      { device: 'Desktop', browser: 'Firefox', os: 'Linux' },
    ],
  ])('reads %s', (ua, expected) => {
    expect(parseUserAgent(ua)).toEqual(expected);
  });

  it('returns nulls for a missing or unknown agent', () => {
    expect(parseUserAgent(undefined)).toEqual({ device: null, browser: null, os: null });
    expect(parseUserAgent('curl/8.4.0')).toEqual({ device: null, browser: null, os: null });
  });
});
