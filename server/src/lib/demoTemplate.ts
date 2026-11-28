/*
 * What every demo sandbox starts with: a fictional job seeker, her three documents, the links she
 * has sent and how they were read. Times are "how long ago", counted from the moment the visitor
 * starts the demo, so the dashboard always looks recent. The PDFs are in server/assets/demo.
 *
 * It is written to show every state the app has: read in full, stopped early, not opened (the
 * follow-up nudge), expired, switched off, links that ask for an email, and a document with too
 * few views for a reading pattern.
 */

export type DemoFileName = 'resume' | 'portfolio' | 'certificates';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface Device {
  device: 'Desktop' | 'Mobile' | 'Tablet';
  browser: string;
  os: string;
}

const WINDOWS_CHROME: Device = { device: 'Desktop', browser: 'Chrome', os: 'Windows' };
const WINDOWS_EDGE: Device = { device: 'Desktop', browser: 'Edge', os: 'Windows' };
const WINDOWS_FIREFOX: Device = { device: 'Desktop', browser: 'Firefox', os: 'Windows' };
const MAC_CHROME: Device = { device: 'Desktop', browser: 'Chrome', os: 'macOS' };
const MAC_SAFARI: Device = { device: 'Desktop', browser: 'Safari', os: 'macOS' };
const IPHONE: Device = { device: 'Mobile', browser: 'Safari', os: 'iOS' };
const ANDROID: Device = { device: 'Mobile', browser: 'Chrome', os: 'Android' };
const IPAD: Device = { device: 'Tablet', browser: 'Safari', os: 'iOS' };

export interface DemoView {
  ago: number;
  /** Active seconds on each page, one entry per page. The last page with time is the furthest reached. */
  seconds: number[];
  on: Device;
  email?: string;
  /** Who read it: views with the same reader count as one person when there is no email. */
  reader: string;
}

export interface DemoLink {
  label: string;
  createdAgo: number;
  requireEmail?: boolean;
  allowDownload?: boolean;
  isActive?: boolean;
  /** Set for a link whose end date has passed. */
  expiredAgo?: number;
  views: DemoView[];
}

export interface DemoDocument {
  file: DemoFileName;
  title: string;
  uploadedAgo: number;
  links: DemoLink[];
}

export const DEMO_OWNER_NAME = 'Neha Verma';

export const DEMO_TEMPLATE: DemoDocument[] = [
  {
    file: 'resume',
    title: 'Neha Verma, Resume',
    uploadedAgo: 24 * DAY,
    links: [
      {
        label: 'Brightline Labs application',
        createdAgo: 6 * DAY,
        requireEmail: true,
        views: [
          { ago: 5 * DAY, seconds: [41, 0], on: WINDOWS_EDGE, email: 'rahul.m@example.com', reader: 'rahul' },
          { ago: DAY + 3 * HOUR, seconds: [35, 12], on: IPHONE, email: 'priya.s@example.com', reader: 'priya-phone' },
          { ago: 2 * HOUR, seconds: [62, 48], on: WINDOWS_CHROME, email: 'priya.s@example.com', reader: 'priya' },
        ],
      },
      {
        label: 'LinkedIn profile',
        createdAgo: 20 * DAY,
        views: [
          { ago: 19 * DAY, seconds: [14, 0], on: IPHONE, reader: 'linkedin-1' },
          { ago: 12 * DAY, seconds: [25, 9], on: WINDOWS_FIREFOX, reader: 'linkedin-2' },
          { ago: 8 * DAY, seconds: [44, 30], on: MAC_CHROME, reader: 'linkedin-3' },
          { ago: 3 * DAY, seconds: [18, 0], on: ANDROID, reader: 'linkedin-4' },
        ],
      },
      {
        label: 'Campus placement cell',
        createdAgo: 23 * DAY,
        expiredAgo: 9 * DAY,
        views: [
          { ago: 22 * DAY, seconds: [52, 38], on: WINDOWS_CHROME, reader: 'campus-1' },
          { ago: 15 * DAY, seconds: [33, 21], on: WINDOWS_CHROME, reader: 'campus-2' },
        ],
      },
      { label: 'Northwind Retail referral', createdAgo: 3 * DAY, views: [] },
    ],
  },
  {
    file: 'portfolio',
    title: 'Neha Verma, Portfolio',
    uploadedAgo: 16 * DAY,
    links: [
      {
        label: 'Pinecrest Analytics design round',
        createdAgo: 10 * DAY,
        allowDownload: true,
        views: [
          { ago: 9 * DAY, seconds: [15, 81, 47, 22], on: WINDOWS_CHROME, reader: 'pinecrest-1' },
          { ago: 4 * DAY, seconds: [8, 40, 0, 0], on: IPAD, reader: 'pinecrest-2' },
          { ago: 2 * DAY, seconds: [10, 66, 21, 0], on: MAC_SAFARI, reader: 'pinecrest-3' },
          { ago: 6 * HOUR, seconds: [12, 74, 58, 9], on: MAC_CHROME, reader: 'pinecrest-3' },
        ],
      },
      {
        label: 'Personal website',
        createdAgo: 14 * DAY,
        views: [
          { ago: 13 * DAY, seconds: [9, 35, 28, 0], on: WINDOWS_EDGE, reader: 'website-1' },
          { ago: 5 * DAY, seconds: [6, 22, 0, 0], on: ANDROID, reader: 'website-2' },
        ],
      },
    ],
  },
  {
    file: 'certificates',
    title: 'Neha Verma, Certificates',
    uploadedAgo: 9 * DAY,
    links: [
      {
        label: 'Brightline Labs, certificates',
        createdAgo: 6 * DAY,
        requireEmail: true,
        views: [{ ago: DAY, seconds: [20, 14, 0], on: WINDOWS_CHROME, email: 'priya.s@example.com', reader: 'priya' }],
      },
      {
        label: 'Old job board profile',
        createdAgo: 8 * DAY,
        isActive: false,
        views: [{ ago: 7 * DAY, seconds: [11, 0, 0], on: WINDOWS_CHROME, reader: 'job-board-1' }],
      },
    ],
  },
];
