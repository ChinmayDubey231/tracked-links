import type { ReactNode, Ref } from 'react';
import { AppFooter } from '../../components/AppFooter';
import { LogoMark } from '../../components/LogoMark';
import { cx } from '../../lib/cx';
import styles from './Viewer.module.css';

function ZoomIcon({ plus }: { plus?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      {plus && <path d="M12 5v14" />}
      <path d="M5 12h14" />
    </svg>
  );
}

/** Zoom out and in. Without handlers (while loading) both buttons are disabled. */
export function ZoomGroup({
  onZoomOut,
  onZoomIn,
  status = '',
}: {
  onZoomOut?: () => void;
  onZoomIn?: () => void;
  status?: string;
}) {
  return (
    <div className={styles.zoomGroup} role="group" aria-label="Zoom">
      <button type="button" className={styles.zoomButton} aria-label="Zoom out" disabled={!onZoomOut} onClick={onZoomOut}>
        <ZoomIcon />
      </button>
      <button type="button" className={styles.zoomButton} aria-label="Zoom in" disabled={!onZoomIn} onClick={onZoomIn}>
        <ZoomIcon plus />
      </button>
      <span className="visually-hidden" role="status">
        {status}
      </span>
    </div>
  );
}

/**
 * The reader's header, main area and footer (design/screens/viewer.html). The reader and its
 * loading screen both use it, so nothing moves when the pages arrive.
 */
export function ReaderFrame({
  title,
  pageLabel,
  controls,
  loading = false,
  reading,
  headerRef,
  notices,
  children,
}: {
  /** Unknown until the link's details arrive: a placeholder bar stands in. */
  title?: string;
  pageLabel?: string;
  controls?: ReactNode;
  /** The bar under the header sweeps while the document loads. */
  loading?: boolean;
  /** Fills the bar under the header with the reader's progress. */
  reading?: { page: number; total: number };
  headerRef?: Ref<HTMLElement>;
  notices?: ReactNode;
  children: ReactNode;
}) {
  const progress = reading ? Math.round((reading.page / Math.max(reading.total, 1)) * 100) : 0;
  return (
    <div className={styles.readerShell}>
      <header ref={headerRef} className={styles.readerHeader}>
        <div className={cx('container', styles.readerHeaderInner)}>
          <div className={styles.readerTitleGroup}>
            <span className={styles.brand}>
              <LogoMark />
              Tracked Links
            </span>
            {title ? (
              <h1 className={styles.docTitle}>{title}</h1>
            ) : (
              <>
                <h1 className="visually-hidden">Shared document</h1>
                <span className={cx(styles.bone, styles.titleBone)} aria-hidden="true" />
              </>
            )}
          </div>
          <div className={styles.readerControls}>
            {pageLabel ? (
              <span className={styles.pageCount}>{pageLabel}</span>
            ) : (
              <span className={cx(styles.bone, styles.pageCountBone)} aria-hidden="true" />
            )}
            {controls}
          </div>
        </div>
        {reading && !loading ? (
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Reading progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-valuetext={`Page ${reading.page} of ${reading.total}`}
          >
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        ) : (
          // Decorative: the loading card's status line says what is happening.
          <div className={styles.progressTrack} aria-hidden="true">
            {loading && <div className={styles.progressSweep} />}
          </div>
        )}
      </header>

      {notices}

      <main id="main" tabIndex={-1} className={styles.readerMain}>
        {children}
      </main>

      <AppFooter variant="reader" />
    </div>
  );
}
