import { formatDuration, pagesReadPhrase, recentWhen, type RecentView } from '@tracked-links/shared';
import styles from './DocumentPage.module.css';

/** The Recent views card: the latest reading sessions across the document's links. */
export function RecentViews({ views, pageCount }: { views: RecentView[]; pageCount: number }) {
  return (
    <section className={styles.recent} aria-labelledby="recent-heading">
      <h2 id="recent-heading" className={styles.recentHeading}>
        Recent views
      </h2>
      {views.length === 0 ? (
        <p className={styles.recentEmpty}>
          No views yet. When someone opens one of your links, their visit shows up here.
        </p>
      ) : (
        <ul className={styles.recentList}>
          {views.map((view) => (
            <li key={view.id} className={styles.recentItem}>
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.recentText}>
                <span className={styles.who}>{view.viewerEmail ?? 'No email given'}</span>
                <span className={styles.meta}>
                  {view.linkLabel}, {recentWhen(view.startedAt)}, {pagesReadPhrase(view.maxPageReached, pageCount)}
                </span>
              </span>
              <span className={styles.duration}>
                <span className="visually-hidden">Read for </span>
                {formatDuration(view.totalDurationMs)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
