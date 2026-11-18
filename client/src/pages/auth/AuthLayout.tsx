import { useLayoutEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { LogoMark } from '../../components/LogoMark';
import styles from './AuthLayout.module.css';

/** Sample heat values for the illustration on the right. */
const SAMPLE_PAGES = [
  { seconds: '48s', opacity: 0.6 },
  { seconds: '31s', opacity: 0.38 },
  { seconds: '16s', opacity: 0.2 },
  { seconds: '7s', opacity: 0.08 },
];

/**
 * Two-column layout shared by Log in and Sign up: the form on the left, the pitch on the right.
 *
 * The links that switch between the two pages use React Router's `viewTransition`, so the form panel
 * slides sideways while the rest of the layout stays still (see AuthLayout.module.css). `page` tells
 * the stylesheet which way to slide: Sign up enters from the right, Log in from the left.
 */
export function AuthLayout({
  page,
  title,
  subtitle,
  children,
  footer,
}: {
  page: 'login' | 'signup';
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  // A layout effect runs before the browser captures the new page, so the slide direction follows the
  // page being shown, including when the browser's Back button replays the transition.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.authPage = page;
    return () => {
      delete root.dataset.authPage;
    };
  }, [page]);

  return (
    <div className={styles.page}>
      <main id="main" tabIndex={-1} className={styles.formSide}>
        <div className={styles.inner}>
          <Link to="/" className={styles.brand}>
            <LogoMark />
            Tracked Links
          </Link>
          <div className={styles.panel}>
            <div className={styles.heading}>
              <h1 className={styles.title}>{title}</h1>
              <p className={styles.subtitle}>{subtitle}</p>
            </div>
            {children}
            <p className={styles.switch}>{footer}</p>
          </div>
        </div>
      </main>
      <section className={styles.pitch} aria-labelledby="auth-pitch">
        <h2 id="auth-pitch" className={styles.pitchTitle}>
          See what happens <span className={styles.pitchAccent}>after you hit send.</span>
        </h2>
        <div className={styles.pages} aria-hidden="true">
          {SAMPLE_PAGES.map((page) => (
            <div key={page.seconds} className={styles.pageItem}>
              <div className={styles.pagePaper}>
                <div className={styles.pageHeat} style={{ opacity: page.opacity }} />
              </div>
              <span className={styles.pageSeconds}>{page.seconds}</span>
            </div>
          ))}
        </div>
        <p className={styles.pitchText}>
          Upload a PDF, make one link per place you share it, and see reading time page by page.
        </p>
      </section>
    </div>
  );
}

export { styles as authStyles };
