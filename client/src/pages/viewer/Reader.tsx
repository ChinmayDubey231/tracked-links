import { useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { AccessResponse, SignedFileResponse } from '@tracked-links/shared';
import { AppFooter } from '../../components/AppFooter';
import { Button } from '../../components/Button';
import { LogoMark } from '../../components/LogoMark';
import { ErrorState, FormAlert, LoadingState } from '../../components/States';
import { api, errorMessage } from '../../lib/api';
import { cx } from '../../lib/cx';
import '../../lib/pdf';
import { useReadingTracker } from './tracker';
import styles from './Viewer.module.css';

/** Widest a page is drawn at 100%, as in the design. */
const BASE_PAGE_WIDTH = 640;
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const DEFAULT_ZOOM = ZOOM_LEVELS.indexOf(1);
/** Pages within this distance of the one on screen are drawn; the rest keep their space until reached. */
const RENDER_AHEAD = 2;
/** Visible-height steps for the IntersectionObserver, every 5%. */
const THRESHOLDS = Array.from({ length: 21 }, (_, index) => index / 20);

interface PageSize {
  width: number;
  height: number;
}

interface PdfProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{ getViewport: (options: { scale: number }) => PageSize }>;
}

function ZoomIcon({ plus }: { plus?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      {plus && <path d="M12 5v14" />}
      <path d="M5 12h14" />
    </svg>
  );
}

/** Downloads the PDF once, as a Blob: pdf.js then needs no further requests, so the short-lived URL can expire. */
function usePdfBlob(url: string) {
  const [state, setState] = useState<{ blob: Blob | null; failed: boolean }>({ blob: null, failed: false });
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`File request failed with ${response.status}`);
        return response.blob();
      })
      .then((blob) => setState({ blob, failed: false }))
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setState({ blob: null, failed: true });
      });
    return () => controller.abort();
  }, [url]);
  return state;
}

/** Tracks the width available for pages. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * The page with the most height on screen, below the sticky header. Each page wrapper carries
 * data-page; `count` re-runs the observer when the wrappers appear.
 */
function useCurrentPage(container: HTMLElement | null, count: number, topOffset: number) {
  const [current, setCurrent] = useState(1);
  useEffect(() => {
    if (!container || count === 0) return;
    const visible = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.page);
          visible.set(page, entry.isIntersecting ? entry.intersectionRect.height : 0);
        }
        let best = 0;
        let bestHeight = 0;
        for (const [page, height] of visible) {
          if (height > bestHeight || (height === bestHeight && height > 0 && page < best)) {
            best = page;
            bestHeight = height;
          }
        }
        if (best > 0) setCurrent(best);
      },
      { rootMargin: `-${topOffset}px 0px 0px 0px`, threshold: THRESHOLDS },
    );
    container.querySelectorAll<HTMLElement>('[data-page]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [container, count, topOffset]);
  return current;
}

/** The public PDF reader (design/screens/viewer.html), with reading-time tracking. */
export default function Reader({ slug, access }: { slug: string; access: AccessResponse }) {
  const { blob, failed } = usePdfBlob(access.file.url);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pagesRef, availableWidth] = useWidth<HTMLDivElement>();
  const [pagesElement, setPagesElement] = useState<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [rendered, setRendered] = useState<Set<number>>(() => new Set([1]));
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const numPages = pageSizes.length;
  const loaded = numPages > 0;
  const currentPage = useCurrentPage(pagesElement, numPages, headerHeight);
  const reportPage = useReadingTracker(access.view, loaded);

  useEffect(() => reportPage(currentPage), [currentPage, reportPage]);

  // Keep the pages near the reader drawn, and keep pages drawn once they have been.
  useEffect(() => {
    setRendered((old) => {
      const next = new Set(old);
      for (let page = currentPage - RENDER_AHEAD; page <= currentPage + RENDER_AHEAD; page += 1) {
        if (page >= 1 && page <= Math.max(numPages, 1)) next.add(page);
      }
      return next.size === old.size ? old : next;
    });
  }, [currentPage, numPages]);

  // The header is sticky on wide screens: pages under it don't count as on screen.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const observer = new ResizeObserver(() => {
      setHeaderHeight(getComputedStyle(header).position === 'sticky' ? header.offsetHeight : 0);
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const setPagesNode = useCallback(
    (node: HTMLDivElement | null) => {
      pagesRef.current = node;
      setPagesElement(node);
    },
    [pagesRef],
  );

  const onLoadSuccess = useCallback(async (pdf: PdfProxy) => {
    const sizes: PageSize[] = [];
    for (let page = 1; page <= pdf.numPages; page += 1) {
      const viewport = (await pdf.getPage(page)).getViewport({ scale: 1 });
      sizes.push({ width: viewport.width, height: viewport.height });
    }
    setPageSizes(sizes);
  }, []);

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const body = access.view ? { viewId: access.view.id, token: access.view.token } : {};
      const { url } = await api<SignedFileResponse>(`/v/${encodeURIComponent(slug)}/download`, { method: 'POST', body });
      window.location.assign(url);
    } catch (error) {
      setDownloadError(errorMessage(error));
    } finally {
      setDownloading(false);
    }
  };

  const totalPages = numPages || access.pageCount;
  const shownPage = Math.min(currentPage, totalPages);
  const progress = Math.round((shownPage / Math.max(totalPages, 1)) * 100);
  const pageWidth = Math.max(Math.min(BASE_PAGE_WIDTH, availableWidth) * ZOOM_LEVELS[zoom]!, 120);

  let body;
  if (failed || loadError) {
    body = (
      <div className={styles.readerMessage}>
        <ErrorState title="This document didn't load" message="Check your internet connection, then reload the page to try again.">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload the page
          </Button>
        </ErrorState>
      </div>
    );
  } else if (!blob) {
    body = (
      <div className={styles.readerMessage}>
        <LoadingState label="Loading the document…" />
      </div>
    );
  } else {
    body = (
      <Document
        file={blob}
        onLoadSuccess={(pdf) => void onLoadSuccess(pdf as unknown as PdfProxy)}
        onLoadError={() => setLoadError(true)}
        loading={
          <div className={styles.readerMessage}>
            <LoadingState label="Preparing the pages…" />
          </div>
        }
        error={null}
        externalLinkTarget="_blank"
        externalLinkRel="noopener noreferrer nofollow"
        className={styles.document}
      >
        {pageSizes.map((size, index) => {
          const pageNumber = index + 1;
          return (
            <div
              key={pageNumber}
              data-page={pageNumber}
              className={styles.paper}
              style={{ width: pageWidth, height: (pageWidth * size.height) / size.width }}
            >
              {rendered.has(pageNumber) && (
                <Page
                  pageNumber={pageNumber}
                  width={pageWidth}
                  loading={null}
                  renderTextLayer
                  renderAnnotationLayer
                />
              )}
            </div>
          );
        })}
      </Document>
    );
  }

  return (
    <div className={styles.readerShell}>
      <header ref={headerRef} className={styles.readerHeader}>
        <div className={cx('container', styles.readerHeaderInner)}>
          <div className={styles.readerTitleGroup}>
            <span className={styles.brand}>
              <LogoMark />
              Tracked Links
            </span>
            <h1 className={styles.docTitle}>{access.title}</h1>
          </div>
          <div className={styles.readerControls}>
            <span className={styles.pageCount}>
              Page {shownPage} of {totalPages}
            </span>
            <div className={styles.zoomGroup} role="group" aria-label="Zoom">
              <button
                type="button"
                className={styles.zoomButton}
                aria-label="Zoom out"
                disabled={zoom === 0}
                onClick={() => setZoom((value) => Math.max(0, value - 1))}
              >
                <ZoomIcon />
              </button>
              <button
                type="button"
                className={styles.zoomButton}
                aria-label="Zoom in"
                disabled={zoom === ZOOM_LEVELS.length - 1}
                onClick={() => setZoom((value) => Math.min(ZOOM_LEVELS.length - 1, value + 1))}
              >
                <ZoomIcon plus />
              </button>
              <span className="visually-hidden" role="status">
                {zoom === DEFAULT_ZOOM ? '' : `Zoom ${Math.round(ZOOM_LEVELS[zoom]! * 100)}%`}
              </span>
            </div>
            {access.allowDownload && (
              <Button onClick={() => void download()} loading={downloading}>
                Download
              </Button>
            )}
          </div>
        </div>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label="Reading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-valuetext={`Page ${shownPage} of ${totalPages}`}
        >
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </header>

      {(access.view === null || downloadError) && (
        <div className={cx('container', styles.notices)}>
          {access.view === null && (
            <p className={styles.previewNotice}>This is your own link, so this visit is not recorded.</p>
          )}
          {downloadError && <FormAlert>{downloadError}</FormAlert>}
        </div>
      )}

      <main id="main" tabIndex={-1} className={styles.readerMain}>
        <div ref={setPagesNode} className={styles.pages}>
          {body}
        </div>
      </main>

      <AppFooter variant="reader" />
    </div>
  );
}
