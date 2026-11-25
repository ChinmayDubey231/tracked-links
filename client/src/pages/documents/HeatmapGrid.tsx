import type { ReactNode } from 'react';
import { formatPercent, formatSeconds, type PageStat } from '@tracked-links/shared';
import { PageThumb } from '../../components/PageThumb';
import { ReachBar } from '../../components/ReachBar';
import styles from './DocumentPage.module.css';

/**
 * One cell per page: the page, shaded by average active time, then its numbers and reach bar.
 * `renderPage` supplies the page image; without one, a generic page stands in.
 */
export function HeatmapGrid({ pages, renderPage }: { pages: PageStat[]; renderPage?: (page: number) => ReactNode }) {
  return (
    <ol className={styles.heatmap} aria-label="Average active time and reach for each page">
      {pages.map((stat) => (
        <li key={stat.page} className={styles.heatPage}>
          <PageThumb image={renderPage?.(stat.page)} opacity={stat.heat} />
          <span className={styles.heatStats}>
            <span className={styles.heatSeconds}>{formatSeconds(stat.avgMs)}</span>
            <span className={styles.heatLabel}>avg. active time</span>
            <span className={styles.heatLabel}>
              Page {stat.page} · {formatPercent(stat.reach)} reached
            </span>
            <ReachBar value={stat.reach} />
          </span>
        </li>
      ))}
    </ol>
  );
}

const SWATCHES = [1, 2, 3, 4];

/** "Average active time / page, 0s to 50s+", as in the design. */
export function HeatLegend() {
  return (
    <div className={styles.legend}>
      <div className={styles.legendScale}>
        <span>Average active time / page</span>
        <span>0s</span>
        <span className={styles.swatches} aria-hidden="true">
          {SWATCHES.map((step) => (
            <span key={step} className={styles.swatch} style={{ background: `var(--color-heat-${step})` }} />
          ))}
        </span>
        <span>50s+</span>
      </div>
      <span>Darker = longer reading time. Teal bars = share of views reaching each page.</span>
    </div>
  );
}
