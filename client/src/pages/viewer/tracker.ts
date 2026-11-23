import { useCallback, useEffect, useRef } from 'react';
import type { HeartbeatRequest } from '@tracked-links/shared';
import { API_URL } from '../../lib/config';

/** How often time is added to the page on screen. */
const TICK_MS = 1_000;
/** How often the added time is sent (the spec asks for every 5 to 10 seconds). */
const HEARTBEAT_MS = 10_000;
/** Counting pauses after this long without scrolling, pointer or key activity. */
const IDLE_MS = 60_000;
/** A longer gap between ticks means the timer was throttled or the device slept: count none of it. */
const MAX_TICK_GAP_MS = 5_000;

const ACTIVITY_EVENTS = ['scroll', 'wheel', 'pointermove', 'pointerdown', 'keydown', 'touchstart'] as const;

/**
 * Measures active reading time per page (docs/spec.md, section 7):
 * - time goes to the page currently on screen (set by the viewer's IntersectionObserver);
 * - only while the tab is visible (Page Visibility API) and the reader was active in the last minute;
 * - a heartbeat every 10 seconds sends the time added since the last one, and the server adds it with $inc;
 * - when the tab is hidden or closed, navigator.sendBeacon sends what is left, since normal requests get
 *   cancelled on unload.
 *
 * Requests use text/plain so the browser sends them to the API's origin without a CORS preflight,
 * which a beacon cannot do.
 */
export class ReadingTracker {
  private readonly pending = new Map<number, number>();
  private currentPage = 1;
  private maxPage = 1;
  private sentMaxPage = 1;
  private lastTick = 0;
  private lastActivity = 0;
  private tickTimer: number | undefined;
  private beatTimer: number | undefined;
  private inFlight = false;
  /** Set when the server refuses the session (it ended or the token is wrong): stop sending. */
  private refused = false;

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  start() {
    const now = performance.now();
    this.lastTick = now;
    this.lastActivity = now;
    this.tickTimer = window.setInterval(() => this.tick(), TICK_MS);
    this.beatTimer = window.setInterval(() => void this.send(false), HEARTBEAT_MS);
    for (const type of ACTIVITY_EVENTS) {
      window.addEventListener(type, this.markActive, { passive: true, capture: true });
    }
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageHide);
  }

  stop() {
    this.flush();
    window.clearInterval(this.tickTimer);
    window.clearInterval(this.beatTimer);
    for (const type of ACTIVITY_EVENTS) {
      window.removeEventListener(type, this.markActive, { capture: true });
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pagehide', this.onPageHide);
  }

  setPage(page: number) {
    if (page === this.currentPage) return;
    // Credit the time so far to the page being left, then switch.
    this.tick();
    this.currentPage = page;
    this.maxPage = Math.max(this.maxPage, page);
  }

  private readonly markActive = () => {
    this.lastActivity = performance.now();
  };

  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      // Count up to the moment the tab was hidden, then send it: a hidden tab may never come back.
      this.tick(true);
      this.flush();
    } else {
      // Nothing is counted for the time away.
      this.lastTick = performance.now();
      this.markActive();
    }
  };

  private readonly onPageHide = () => this.flush();

  private tick(countEvenIfHidden = false) {
    const now = performance.now();
    const gap = now - this.lastTick;
    this.lastTick = now;
    if (!countEvenIfHidden && document.visibilityState !== 'visible') return;
    if (now - this.lastActivity > IDLE_MS) return;
    const add = Math.min(gap, MAX_TICK_GAP_MS);
    if (add > 0) this.pending.set(this.currentPage, (this.pending.get(this.currentPage) ?? 0) + add);
  }

  /** Takes the time collected since the last send, or null when there is nothing new. */
  private take(): { body: HeartbeatRequest; taken: Map<number, number> } | null {
    const taken = new Map(this.pending);
    const pages = [...taken].map(([page, ms]) => ({ page, ms: Math.round(ms) })).filter((entry) => entry.ms > 0);
    if (pages.length === 0 && this.maxPage <= this.sentMaxPage) return null;
    this.pending.clear();
    return { body: { token: this.token, pages, maxPage: this.maxPage }, taken };
  }

  private putBack(taken: Map<number, number>) {
    for (const [page, ms] of taken) this.pending.set(page, (this.pending.get(page) ?? 0) + ms);
  }

  /** The final update, by beacon. Falls back to a keepalive fetch where beacons are missing or refused. */
  private flush() {
    if (this.refused) return;
    this.tick();
    const next = this.take();
    if (!next) return;
    const json = JSON.stringify(next.body);
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(this.url, json)) {
      this.sentMaxPage = next.body.maxPage;
      return;
    }
    this.putBack(next.taken);
    void this.send(true);
  }

  private async send(force: boolean) {
    if (this.refused || (this.inFlight && !force)) return;
    this.tick();
    const next = this.take();
    if (!next) return;

    this.inFlight = true;
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(next.body),
        keepalive: true,
      });
      if (response.status === 403 || response.status === 404) {
        this.refused = true;
        return;
      }
      if (!response.ok) throw new Error(`Heartbeat failed with ${response.status}`);
      this.sentMaxPage = Math.max(this.sentMaxPage, next.body.maxPage);
    } catch {
      // Offline or rate-limited: keep the time and send it with the next heartbeat.
      this.putBack(next.taken);
    } finally {
      this.inFlight = false;
    }
  }
}

/**
 * Runs a ReadingTracker for a View while `enabled`, and returns a function to report
 * the page on screen. With no View (the owner previewing their own link), nothing is sent.
 */
export function useReadingTracker(view: { id: string; token: string } | null, enabled: boolean) {
  const trackerRef = useRef<ReadingTracker | null>(null);
  const pageRef = useRef(1);

  useEffect(() => {
    if (!view || !enabled) return;
    const tracker = new ReadingTracker(`${API_URL}/views/${encodeURIComponent(view.id)}/heartbeat`, view.token);
    tracker.start();
    tracker.setPage(pageRef.current);
    trackerRef.current = tracker;
    return () => {
      tracker.stop();
      trackerRef.current = null;
    };
  }, [view, enabled]);

  return useCallback((page: number) => {
    pageRef.current = page;
    trackerRef.current?.setPage(page);
  }, []);
}
