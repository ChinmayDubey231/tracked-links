import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { AppFooter } from './AppFooter';
import { TopBar } from './TopBar';
import styles from './OwnerShell.module.css';

/** Layout for signed-in screens: top bar, optional sub-header, main content, footer. */
export function OwnerShell({
  subHeader,
  children,
  mainClassName,
}: {
  subHeader?: ReactNode;
  children: ReactNode;
  mainClassName?: string;
}) {
  return (
    <div className={styles.shell}>
      <TopBar />
      {subHeader}
      <main id="main" tabIndex={-1} className={cx('container', styles.main, mainClassName)}>
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
