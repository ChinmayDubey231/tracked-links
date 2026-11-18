import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../lib/auth';
import { cx } from '../lib/cx';
import { AppFooter } from './AppFooter';
import { ButtonLink } from './Button';
import { LogoMark } from './LogoMark';
import styles from './PublicShell.module.css';

/** Layout for public pages: a simple header with sign-in links, content, and the footer. */
export function PublicShell({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={cx('container', styles.inner)}>
          <Link to="/" className={styles.brand}>
            <LogoMark />
            Tracked Links
          </Link>
          <nav aria-label="Account" className={styles.nav}>
            {status === 'authenticated' ? (
              <ButtonLink to="/documents" variant="secondary">
                Your documents
              </ButtonLink>
            ) : (
              <>
                <Link to="/login" className={styles.textLink}>
                  Log in
                </Link>
                <ButtonLink to="/signup">Create an account</ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className={cx('container', styles.main)}>
        {children}
      </main>
      <AppFooter />
    </div>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <article className={styles.prose}>{children}</article>;
}
