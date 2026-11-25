import { Link } from 'react-router';
import {
  countLabel,
  formatDuration,
  notOpenedDetail,
  relativeTimeInSentence,
  type LinkSummary,
} from '@tracked-links/shared';
import { ButtonLink } from '../../components/Button';
import { ReadingChip, StatusChip } from '../../components/StatusChip';
import styles from './DocumentLinks.module.css';

/** Expired or Off says more than how it was read, so it takes the chip's place. */
function LinkChip({ link }: { link: LinkSummary }) {
  if (link.status !== 'active') return <StatusChip status={link.status} size="sm" />;
  return <ReadingChip reading={link.reading} size="sm" />;
}

/** "2m 05s average, last opened 2 hours ago", or a follow-up prompt for a link nobody opened. */
function linkDetail(link: LinkSummary): string {
  if (link.views === 0 || !link.lastViewedAt) {
    if (link.status === 'active') return notOpenedDetail(link.createdAt);
    return `Sent ${relativeTimeInSentence(link.createdAt)}. No one opened it.`;
  }
  return `${formatDuration(link.avgReadMs)} average, last opened ${relativeTimeInSentence(link.lastViewedAt)}`;
}

/** The Links card on Document analytics: each link with its reading status, opening its Link views screen. */
export function DocumentLinks({ documentId, links }: { documentId: string; links: LinkSummary[] }) {
  return (
    <section className={styles.card} aria-labelledby="links-heading">
      <h2 id="links-heading" className={styles.heading}>
        Links
      </h2>
      {links.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.muted}>
            No links yet. Make one for each place you send this document, such as “TCS application” or “LinkedIn bio”.
          </p>
          <ButtonLink to={`/documents/${documentId}/links/new`}>Create a share link</ButtonLink>
        </div>
      ) : (
        <ul className={styles.list}>
          {links.map((link) => (
            <li key={link.id}>
              <Link to={`/links/${link.id}`} className={styles.row}>
                <span className={styles.main}>
                  <span className={styles.labelLine}>
                    <span className={styles.label}>{link.label}</span>
                    <LinkChip link={link} />
                  </span>
                  <span className={styles.slug}>/v/{link.slug}</span>
                  <span className={styles.muted}>{linkDetail(link)}</span>
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
