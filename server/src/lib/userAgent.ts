/**
 * A small user-agent reader for the three things the analytics show: device
 * type, browser and operating system ("Desktop, Chrome, Windows"). It covers the
 * browsers recruiters use; anything else becomes null and shows as "Unknown".
 */
export interface UserAgentInfo {
  device: 'Desktop' | 'Mobile' | 'Tablet' | null;
  browser: string | null;
  os: string | null;
}

// Order matters: Edge, Opera and Samsung Internet also say "Chrome", and Chrome also says "Safari".
const BROWSERS: Array<[RegExp, string]> = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\b(?:OPR|Opera|OPT)\//, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\b(?:Firefox|FxiOS)\//, 'Firefox'],
  [/\b(?:Chrome|CriOS|Chromium)\//, 'Chrome'],
  [/\bVersion\/[\d.]+.*\bSafari\//, 'Safari'],
];

const OPERATING_SYSTEMS: Array<[RegExp, string]> = [
  [/\b(?:iPhone|iPod|iPad)\b/, 'iOS'],
  [/\bAndroid\b/, 'Android'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bWindows\b/, 'Windows'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
];

export function parseUserAgent(ua: string | undefined | null): UserAgentInfo {
  if (!ua) return { device: null, browser: null, os: null };

  const browser = BROWSERS.find(([pattern]) => pattern.test(ua))?.[1] ?? null;
  const os = OPERATING_SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1] ?? null;

  let device: UserAgentInfo['device'];
  if (/\biPad\b|\bTablet\b/.test(ua) || (/\bAndroid\b/.test(ua) && !/\bMobile\b/.test(ua))) {
    device = 'Tablet';
  } else if (/\bMobi|\biPhone\b|\biPod\b/.test(ua)) {
    device = 'Mobile';
  } else if (os || browser) {
    device = 'Desktop';
  } else {
    device = null;
  }

  return { device, browser, os };
}
