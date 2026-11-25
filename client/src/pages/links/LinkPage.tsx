import { useId } from 'react';
import { useParams } from 'react-router';
import {
  capitalize,
  countLabel,
  countPhrase,
  deviceLabel,
  formatDuration,
  latestViewSentence,
  linkSettingsSummary,
  notOpenedDetail,
  openedAt,
  relativeTime,
  relativeTimeInSentence,
  VIEWS_PAGE_SIZE,
  type LinkDetailResponse,
  type ViewRow,
} from '@tracked-links/shared';
import { Button, ButtonLink } from '../../components/Button';
import { CopyButton } from '../../components/CopyButton';
import { DataTable, type Column } from '../../components/DataTable';
import { OwnerShell } from '../../components/OwnerShell';
import { PagesReachedMeter } from '../../components/PagesReachedMeter';
import { StatTile } from '../../components/StatTile';
import { ErrorState, FormAlert, LoadingState } from '../../components/States';
import { ReadingChip } from '../../components/StatusChip';
import { SubHeader } from '../../components/SubHeader';
import { useLinkViews } from '../../lib/analytics';
import { errorMessage } from '../../lib/api';
import { shareUrl } from '../../lib/config';
import { useLink, useUpdateLink } from '../../lib/links';
import { usePageTitle } from '../../lib/usePageTitle';
import docStyles from '../documents/DocumentsPage.module.css';
import styles from './LinkPages.module.css';

/** "Nine views from six people." */
export function linkViewsHeadline(views: number, uniqueViewers: number): string {
  if (views === 0) return 'Not opened yet.';
  return `${capitalize(countPhrase(views, 'view'))} from ${countPhrase(uniqueViewers, 'person', 'people')}.`;
}

/** The PagesReachedMeter draws blocks up to 8 pages, a bar above that. */
const MAX_BLOCK_PAGES = 8;

/** The "Link is on" switch from the Link views screen. */
function ActiveSwitch({ data }: { data: LinkDetailResponse }) {
  const update = useUpdateLink(data.link.id);
  const inputId = useId();
  const checked = update.isPending ? Boolean(update.variables?.isActive) : data.link.isActive;

  return (
    <div className={styles.switchWrap}>
      <div className={styles.switch}>
        <input
          id={inputId}
          type="checkbox"
          className={styles.switchInput}
          checked={checked}
          disabled={update.isPending}
          onChange={(event) => update.mutate({ isActive: event.target.checked })}
        />
        <label htmlFor={inputId} className={styles.switchLabel}>
          Link is on
        </label>
      </div>
      {update.isError && <FormAlert>{errorMessage(update.error)}</FormAlert>}
    </div>
  );
}

/** Under the headline: the reading chip, then who read what most recently (or a follow-up prompt). */
function StatusLine({ data }: { data: LinkDetailResponse }) {
  const { link, latestView, document } = data;
  let text: string;
  if (latestView) text = latestViewSentence(latestView, document.pageCount);
  else if (link.status === 'active') text = notOpenedDetail(link.createdAt);
  else text = `Sent ${relativeTimeInSentence(link.createdAt)}. No one opened it.`;

  return (
    <div className={styles.statusRow}>
      <ReadingChip reading={link.reading} />
      <span className={styles.statusText}>{text}</span>
    </div>
  );
}

function viewColumns(pageCount: number): Column<ViewRow>[] {
  return [
    {
      id: 'opened',
      header: 'Opened',
      width: '16%',
      cell: (view) => <span className={styles.nowrap}>{openedAt(view.startedAt)}</span>,
    },
    {
      id: 'viewer',
      header: 'Viewer',
      cell: (view) =>
        view.viewerEmail ? (
          <span className={styles.viewer}>{view.viewerEmail}</span>
        ) : (
          <span className={styles.noEmail}>No email given</span>
        ),
    },
    {
      id: 'pages',
      header: 'Pages reached',
      width: '16%',
      cell: (view) => <PagesReachedMeter reached={view.maxPageReached} total={pageCount} />,
    },
    {
      id: 'duration',
      header: 'Duration',
      align: 'right',
      width: '13%',
      cell: (view) => <span className={styles.duration}>{formatDuration(view.totalDurationMs)}</span>,
    },
    {
      id: 'device',
      header: 'Device',
      width: '22%',
      cell: (view) => <span className={styles.device}>{deviceLabel(view)}</span>,
    },
  ];
}

/** The link's views, newest first, a page at a time. */
function ViewsTable({ linkId, total, pageCount }: { linkId: string; total: number; pageCount: number }) {
  const query = useLinkViews(linkId, total > 0);

  if (total === 0) {
    return (
      <p className={styles.notice}>
        No views yet. Each time someone opens the link, the visit shows up here with the pages they reached, how long
        they read and their device.
      </p>
    );
  }
  if (query.isPending) return <LoadingState label="Loading the views…" />;
  // A failed "Show all" keeps the rows already loaded, so only a failed first page replaces the table.
  if (!query.data) {
    return <ErrorState title="The views didn't load" message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  }

  const rows = query.data.pages.flatMap((page) => page.views);
  const shownOf = query.data.pages[0]?.total ?? total;
  const remaining = shownOf - rows.length;
  const hint =
    pageCount <= MAX_BLOCK_PAGES
      ? 'Each small page is one page of the document; filled means it was reached.'
      : 'Each bar shows how far into the document the view got.';

  return (
    <>
      <DataTable
        caption="Views of this link, newest first"
        columns={viewColumns(pageCount)}
        rows={rows}
        rowKey={(view) => view.id}
        minWidth={760}
        density="regular"
      />
      <div className={styles.tableFooter}>
        <span className={styles.tableHint}>
          Showing {rows.length} of {countLabel(shownOf, 'view')}. {hint}
        </span>
        {query.hasNextPage && (
          <Button variant="secondary" onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>
            {remaining <= VIEWS_PAGE_SIZE ? 'Show all' : `Show ${VIEWS_PAGE_SIZE} more`}
          </Button>
        )}
      </div>
      {query.isFetchNextPageError && <FormAlert>{errorMessage(query.error)}</FormAlert>}
    </>
  );
}

/**
 * /links/:id, Link views (design/screens/link-views.html plus the 2026-11-14 canvas):
 * the link's settings, its reading status, summary numbers and every view.
 */
export default function LinkPage() {
  const { id } = useParams();
  const query = useLink(id);
  usePageTitle(query.data?.link.label ?? 'Link');

  const data = query.data;
  const subHeader = (
    <SubHeader
      crumbs={[
        { label: 'Documents', to: '/documents' },
        ...(data ? [{ label: data.document.title, to: `/documents/${data.document.id}` }] : []),
        { label: data?.link.label ?? 'Link' },
      ]}
      actions={
        data ? (
          <>
            <ActiveSwitch data={data} />
            <ButtonLink to={`/links/${data.link.id}/edit`} variant="secondary">
              Edit settings
            </ButtonLink>
          </>
        ) : undefined
      }
    />
  );

  let content;
  if (query.isPending) {
    content = <LoadingState label="Loading the link…" />;
  } else if (query.isError) {
    content = <ErrorState title="This link didn't load" message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  } else {
    const { link, uniqueViewers, reachedLastPage, document } = query.data;
    const url = shareUrl(link.slug);
    content = (
      <>
        <div className={styles.linkHead}>
          <h1 className={docStyles.title}>{linkViewsHeadline(link.views, uniqueViewers)}</h1>
          <StatusLine data={query.data} />
          <div className={styles.urlRow}>
            <span className={styles.url}>{url}</span>
            <CopyButton text={url} label="Copy link" />
          </div>
          <p className={docStyles.subtitle}>{linkSettingsSummary(link)}</p>
        </div>
        {link.status !== 'active' && (
          <p className={styles.notice} role="status">
            {link.status === 'off'
              ? 'This link is switched off. Anyone who opens it is told to ask you for a new one. Switch it on to let them read again.'
              : 'This link has expired. Anyone who opens it is told to ask you for a new one. Choose a later date in Edit settings to open it again.'}
          </p>
        )}
        <div className={styles.tiles}>
          <StatTile size="lg" value={formatDuration(link.avgReadMs)} label="average reading time" />
          <StatTile
            size="lg"
            value={link.views > 0 ? `${reachedLastPage} of ${link.views}` : '—'}
            label={link.views === 1 ? 'view reached the last page' : 'views reached the last page'}
          />
          <StatTile size="lg" value={link.lastViewedAt ? relativeTime(link.lastViewedAt) : 'Not yet'} label="last opened" />
        </div>
        <ViewsTable linkId={link.id} total={link.views} pageCount={document.pageCount} />
      </>
    );
  }

  return <OwnerShell subHeader={subHeader}>{content}</OwnerShell>;
}
