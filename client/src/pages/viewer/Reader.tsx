import { useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { AccessResponse, SignedFileResponse } from '@tracked-links/shared';
import { Button } from '../../components/Button';
import { ErrorState, FormAlert } from '../../components/States';
import { api, errorMessage } from '../../lib/api';
import { cx } from '../../lib/cx';
import '../../lib/pdf';
import { usePdfBlob } from '../../lib/usePdfBlob';
import { ReaderFrame, ZoomGroup } from './ReaderFrame';
import { useReadingTracker } from './tracker';
import { LoadingSheet } from './ViewerLoading';
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
  const { blob, failed, progress: downloaded } = usePdfBlob(access.file.url);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [firstPageDrawn, setFirstPageDrawn] = useState(false);
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
  // The loading sheet stays until page 1 is drawn, so the reader never sees a blank page.
  const ready = numPages > 0 && firstPageDrawn;
  const currentPage = useCurrentPage(pagesElement, numPages, headerHeight);
  const reportPage = useReadingTracker(access.view, ready);

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
  const pageWidth = Math.max(Math.min(BASE_PAGE_WIDTH, availableWidth) * ZOOM_LEVELS[zoom]!, 120);
  const broken = failed || loadError;

  let body;
  if (broken) {
    body = (
      <div className={styles.readerMessage}>
        <ErrorState title="This document didn't load" message="Check your internet connection, then reload the page to try again.">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload the page
          </Button>
        </ErrorState>
      </div>
    );
  } else {
    // The sheet keeps its place while the file downloads, pdf.js reads it and page 1 is drawn.
    // The Document mounts underneath, hidden, as soon as the file is in.
    // suspense={false}: react-pdf 11 loads through Suspense by default. Each page load would then
    // swap the whole reader for ViewerPage's Suspense fallback and, under StrictMode, re-run this
    // component's effects (downloading the PDF again, in a loop). Pages inherit the setting.
    body = (
      <>
        {!ready && <LoadingSheet step={blob ? 'pages' : 'file'} progress={downloaded} />}
        {blob && (
          <Document
            suspense={false}
            file={blob}
            onLoadSuccess={(pdf) => void onLoadSuccess(pdf as unknown as PdfProxy)}
            onLoadError={() => setLoadError(true)}
            loading={null}
            error={null}
            externalLinkTarget="_blank"
            externalLinkRel="noopener noreferrer nofollow"
            className={cx(styles.document, !ready && styles.documentPending)}
          >
            {pageSizes.map((size, index) => {
              const pageNumber = index + 1;
              const isFirst = pageNumber === 1;
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
                      // A page that fails to draw still lets the reader in rather than loading forever.
                      onRenderSuccess={isFirst ? () => setFirstPageDrawn(true) : undefined}
                      onRenderError={isFirst ? () => setFirstPageDrawn(true) : undefined}
                    />
                  )}
                </div>
              );
            })}
          </Document>
        )}
      </>
    );
  }

  return (
    <ReaderFrame
      title={access.title}
      pageLabel={`Page ${shownPage} of ${totalPages}`}
      headerRef={headerRef}
      loading={!ready && !broken}
      reading={ready ? { page: shownPage, total: totalPages } : undefined}
      controls={
        <>
          <ZoomGroup
            onZoomOut={ready && zoom > 0 ? () => setZoom((value) => Math.max(0, value - 1)) : undefined}
            onZoomIn={
              ready && zoom < ZOOM_LEVELS.length - 1
                ? () => setZoom((value) => Math.min(ZOOM_LEVELS.length - 1, value + 1))
                : undefined
            }
            status={zoom === DEFAULT_ZOOM ? '' : `Zoom ${Math.round(ZOOM_LEVELS[zoom]! * 100)}%`}
          />
          {access.allowDownload && (
            <Button onClick={() => void download()} loading={downloading}>
              Download
            </Button>
          )}
        </>
      }
      notices={
        (access.view === null || downloadError) && (
          <div className={cx('container', styles.notices)}>
            {access.view === null && (
              <p className={styles.previewNotice}>This is your own link, so this visit is not recorded.</p>
            )}
            {downloadError && <FormAlert>{downloadError}</FormAlert>}
          </div>
        )
      }
    >
      <div ref={setPagesNode} className={styles.pages}>
        {body}
      </div>
    </ReaderFrame>
  );
}
