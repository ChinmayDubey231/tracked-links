import { useRef, type ReactNode } from 'react';
import { Document, Page } from 'react-pdf';
import type { PageStat } from '@tracked-links/shared';
import '../../lib/pdf';
import { useInViewOnce } from '../../lib/useInViewOnce';
import { HeatmapGrid } from './HeatmapGrid';
import styles from './DocumentPage.module.css';

/** Pages are drawn at this CSS width (times the screen's pixel ratio), then scaled to fit their cell. */
const RENDER_WIDTH = 320;

/** A page drawn once it scrolls near the screen, so long documents don't render every page up front. */
function ThumbPage({ pageNumber }: { pageNumber: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInViewOnce(ref, 0);
  return (
    <div ref={ref} className={styles.pdfPage}>
      {inView && (
        <Page
          pageNumber={pageNumber}
          width={RENDER_WIDTH}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={null}
          error={null}
        />
      )}
    </div>
  );
}

/** The heatmap with the real pages, rendered by react-pdf. Loaded on demand: pdf.js is large. */
export default function PdfHeatmap({
  blob,
  pages,
  fallback,
  onError,
}: {
  blob: Blob;
  pages: PageStat[];
  fallback: ReactNode;
  onError: () => void;
}) {
  return (
    <Document file={blob} loading={fallback} error={fallback} onLoadError={onError}>
      <HeatmapGrid pages={pages} renderPage={(page) => <ThumbPage pageNumber={page} />} />
    </Document>
  );
}
