import { lazy, Suspense, useState } from 'react';
import type { PageStat } from '@tracked-links/shared';
import { useDocumentFileUrl } from '../../lib/analytics';
import { usePdfBlob } from '../../lib/usePdfBlob';
import { HeatmapGrid } from './HeatmapGrid';
import styles from './DocumentPage.module.css';

const PdfHeatmap = lazy(() => import('./PdfHeatmap'));

/**
 * The document's pages shaded by average active time, with a reach bar under each.
 * Until the PDF has loaded (or if it can't), generic pages stand in, with page 1's
 * saved thumbnail where there is one, so the numbers show straight away.
 */
export function PageHeatmap({
  documentId,
  pages,
  thumbnailUrl,
}: {
  documentId: string;
  pages: PageStat[];
  thumbnailUrl: string | null;
}) {
  const fileUrl = useDocumentFileUrl(documentId);
  const { blob, failed } = usePdfBlob(fileUrl.data);
  const [renderFailed, setRenderFailed] = useState(false);

  const placeholder = <HeatmapGrid pages={pages} renderPage={(page) => (page === 1 ? thumbnailUrl : null)} />;
  const previewsFailed = fileUrl.isError || failed || renderFailed;

  return (
    <div className={styles.heatmapWrap}>
      {blob && !renderFailed ? (
        <Suspense fallback={placeholder}>
          <PdfHeatmap blob={blob} pages={pages} fallback={placeholder} onError={() => setRenderFailed(true)} />
        </Suspense>
      ) : (
        placeholder
      )}
      {previewsFailed && (
        <p className={styles.previewNote}>
          The page previews didn’t load, so plain pages stand in. The shading still shows reading time. Reload the page
          to try again.
        </p>
      )}
    </div>
  );
}
