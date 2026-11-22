import { Link } from 'react-router';
import { countLabel, relativeTimeInSentence } from '@tracked-links/shared';
import { ButtonLink } from '../../components/Button';
import { ErrorState, LoadingState } from '../../components/States';
import { StatusChip } from '../../components/StatusChip';
import { errorMessage } from '../../lib/api';
import { useDocumentLinks } from '../../lib/links';
import styles from './DocumentLinks.module.css';

/** The document's links, each opening its Link screen. Phase 3 adds reading statistics per link. */
export function DocumentLinks({ documentId }: { documentId: string }) {
  const query = useDocumentLinks(documentId);

  return (
    <section className={styles.card} aria-labelledby="links-heading">
      <h2 id="links-heading" className={styles.heading}>
        Links
      </h2>
      {query.isPending ? (
        <LoadingState label="Loading links…" />
      ) : query.isError ? (
        <ErrorState title="The links didn't load" message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.muted}>
            No links yet. Make one for each place you send this document, such as “TCS application” or “LinkedIn bio”.
          </p>
          <ButtonLink to={`/documents/${documentId}/links/new`}>Create a share link</ButtonLink>
        </div>
      ) : (
        <ul className={styles.list}>
          {query.data.map((link) => (
            <li key={link.id}>
              <Link to={`/links/${link.id}`} className={styles.row}>
                <span className={styles.main}>
                  <span className={styles.labelLine}>
                    <span className={styles.label}>{link.label}</span>
                    {link.status !== 'active' && <StatusChip status={link.status} />}
                  </span>
                  <span className={styles.slug}>/v/{link.slug}</span>
                  <span className={styles.muted}>
                    {link.lastViewedAt
                      ? `Last opened ${relativeTimeInSentence(link.lastViewedAt)}`
                      : `Created ${relativeTimeInSentence(link.createdAt)}, not opened yet`}
                  </span>
                </span>
                <span className={styles.views}>{countLabel(link.views, 'view')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
