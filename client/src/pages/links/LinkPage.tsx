import { useId } from 'react';
import { useParams } from 'react-router';
import { capitalize, countPhrase, linkSettingsSummary, type LinkDetailResponse } from '@tracked-links/shared';
import { ButtonLink } from '../../components/Button';
import { CopyButton } from '../../components/CopyButton';
import { OwnerShell } from '../../components/OwnerShell';
import { ErrorState, FormAlert, LoadingState } from '../../components/States';
import { SubHeader } from '../../components/SubHeader';
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

/**
 * /links/:id: one link's settings. The list of its views (design/screens/link-views.html) is built in phase 3.
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
    const { link, uniqueViewers } = query.data;
    const url = shareUrl(link.slug);
    content = (
      <>
        <div className={docStyles.headline}>
          <h1 className={docStyles.title}>{linkViewsHeadline(link.views, uniqueViewers)}</h1>
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
        <p className={docStyles.footnote}>The list of views for this link, with pages reached and devices, arrives in phase 3.</p>
      </>
    );
  }

  return <OwnerShell subHeader={subHeader}>{content}</OwnerShell>;
}
