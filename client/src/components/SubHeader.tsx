import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cx } from '../lib/cx';
import styles from './SubHeader.module.css';

export interface Crumb {
  label: string;
  to?: string;
}

/** Breadcrumb on the left, page actions on the right. */
export function SubHeader({ crumbs, actions }: { crumbs: Crumb[]; actions?: ReactNode }) {
  return (
    <div className={cx('container', styles.bar)}>
      <nav aria-label="Breadcrumb">
        <ol className={styles.crumbs}>
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${index}`}>
                {index > 0 && (
                  <span className={styles.sep} aria-hidden="true">
                    /
                  </span>
                )}
                {crumb.to && !isLast ? (
                  <Link to={crumb.to}>{crumb.label}</Link>
                ) : (
                  <span className={styles.current} aria-current={isLast ? 'page' : undefined}>
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
