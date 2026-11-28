import { useId, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  countLabel,
  formatBytes,
  formatDate,
  formatDuration,
  formatPercent,
  type AnalyticsRange,
  type DocumentResponse,
} from '@tracked-links/shared';
import { ButtonLink } from '../../components/Button';
import { useIsDemo } from '../../components/Demo';
import { OwnerShell } from '../../components/OwnerShell';
import { StatTile } from '../../components/StatTile';
import { ErrorState, LoadingState } from '../../components/States';
import { SubHeader } from '../../components/SubHeader';
import { parseRange, useDocumentAnalytics } from '../../lib/analytics';
import { api, errorMessage } from '../../lib/api';
import { cx } from '../../lib/cx';
import { useFileReplace } from '../../lib/upload';
import { usePageTitle } from '../../lib/usePageTitle';
import { DocumentLinks } from './DocumentLinks';
import { HeatLegend } from './HeatmapGrid';
import { PageHeatmap } from './PageHeatmap';
import { RecentViews } from './RecentViews';
import { ReplaceFileButton, ReplaceStatus } from './ReplaceFile';
import styles from './DocumentPage.module.css';
import headStyles from './DocumentsPage.module.css';

/** The document on its own, for screens that only need its title (New link). */
export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['documents', id],
    queryFn: ({ signal }) => api<DocumentResponse>(`/documents/${id}`, { signal }).then((res) => res.document),
    enabled: Boolean(id),
  });
}

const RANGES: Array<{ value: AnalyticsRange; label: string; period: string }> = [
  { value: 'all', label: 'All time', period: 'since upload' },
  { value: '30d', label: 'Last 30 days', period: 'last 30 days' },
  { value: '7d', label: 'Last 7 days', period: 'last 7 days' },
];

function ChevronIcon() {
  return (
    <svg
      className={styles.chevron}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** "Date range: All time", a native select styled as the design's pill button. */
function RangeSelect({ value, onChange }: { value: AnalyticsRange; onChange: (range: AnalyticsRange) => void }) {
  const id = useId();
  return (
    <div className={styles.rangeControl}>
      <label htmlFor={id} className={styles.rangeLabel}>
        Date range
      </label>
      <span className={styles.selectWrap}>
        <select
          id={id}
          className={styles.select}
          value={value}
          onChange={(event) => onChange(parseRange(event.target.value))}
        >
          {RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
        <ChevronIcon />
      </span>
    </div>
  );
}

/**
 * /documents/:id, Document analytics (design/screens/document-analytics.html plus the
 * 2026-11-14 canvas): the reading headline, page heatmap with reach, stats, links and recent views.
 * The date range applies to the reading analysis; the links and recent views are all-time.
 */
export default function DocumentPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const range = parseRange(searchParams.get('range'));
  const query = useDocumentAnalytics(id, range);
  const data = query.data;
  usePageTitle(data?.document.title ?? 'Document');
  const replace = useFileReplace(id);
  const isDemo = useIsDemo();
  const [pagesBefore, setPagesBefore] = useState<number | null>(null);

  const setRange = (next: AnalyticsRange) =>
    setSearchParams(next === 'all' ? {} : { range: next }, { replace: true, preventScrollReset: true });

  const subHeader = (
    <SubHeader
      crumbs={[{ label: 'Documents', to: '/documents' }, { label: data?.document.title ?? 'Document' }]}
      actions={
        data ? (
          <>
            {!isDemo && (
              <ReplaceFileButton
                busy={replace.busy}
                onFile={(file) => {
                  setPagesBefore(data.document.pageCount);
                  void replace.start(file);
                }}
              />
            )}
            <ButtonLink to={`/documents/${data.document.id}/links/new`}>New link</ButtonLink>
          </>
        ) : undefined
      }
    />
  );

  let content;
  if (!data) {
    content = query.isError ? (
      <ErrorState title="This document didn't load" message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
    ) : (
      <LoadingState label="Loading the document’s analytics…" />
    );
  } else {
    const { document: doc, stats } = data;
    const period = RANGES.find((option) => option.value === data.range)!.period;
    let subtitle = 'Compare active reading time with page reach. Time counts only while the document tab is visible.';
    if (stats.views === 0) {
      subtitle =
        data.range === 'all'
          ? 'No views yet. Share a link, and reading time for each page shows up here as people read.'
          : `No views in the ${period}. Choose All time to see earlier views.`;
    }

    content = (
      <div className={styles.layout}>
        <ReplaceStatus state={replace.state} title={doc.title} pagesBefore={pagesBefore} onDismiss={replace.reset} />
        <div className={styles.periodRow}>
          <span className={styles.period}>Reporting period · {period}</span>
          <RangeSelect value={range} onChange={setRange} />
        </div>

        <section
          className={cx(styles.reading, query.isPlaceholderData && styles.busy)}
          aria-busy={query.isPlaceholderData || undefined}
          aria-labelledby="analytics-headline"
        >
          <div className={headStyles.headline}>
            <h1 id="analytics-headline" className={headStyles.title}>
              {data.headline}
            </h1>
            <p className={headStyles.subtitle}>{subtitle}</p>
          </div>
          <PageHeatmap documentId={doc.id} version={doc.version} pages={data.pages} thumbnailUrl={doc.thumbnailUrl} />
          <HeatLegend />
          <div className={styles.tiles}>
            <StatTile value={stats.views} label={stats.views === 1 ? 'view' : 'views'} />
            <StatTile value={stats.uniqueViewers} label={stats.uniqueViewers === 1 ? 'unique viewer' : 'unique viewers'} />
            <StatTile value={formatDuration(stats.avgReadMs)} label="average reading time" />
            <StatTile value={formatPercent(stats.reachedLastPage)} label="reached the last page" />
          </div>
          <p className={headStyles.footnote}>
            {countLabel(doc.pageCount, 'page')}, {formatBytes(doc.sizeBytes)}, uploaded {formatDate(doc.createdAt)}
            {doc.replacedAt && `, replaced ${formatDate(doc.replacedAt)} (version ${doc.version})`}.
          </p>
        </section>

        <aside className={styles.aside} aria-label="Links and recent views">
          <DocumentLinks documentId={doc.id} links={data.links} />
          <RecentViews views={data.recentViews} />
        </aside>
      </div>
    );
  }

  return (
    <OwnerShell subHeader={subHeader} mainClassName={styles.main}>
      {content}
    </OwnerShell>
  );
}
