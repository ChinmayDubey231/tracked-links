import type { MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router';
import { cx } from '../lib/cx';
import styles from './AppFooter.module.css';

type Variant = 'owner' | 'viewer' | 'reader';

/** A router link styled like the footer's links, for pages and sections (to="#id") inside the app. */
export function FooterLink({
  to,
  onClick,
  children,
}: {
  to: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={styles.link} onClick={onClick}>
      {children}
    </Link>
  );
}

/**
 * A plain anchor styled like the footer's links, for external sites. Use FooterLink for sections on the
 * page: React Router treats a plain #hash jump as a new visit and scrolls back to where it was.
 */
export function FooterAnchor({ href, external, children }: { href: string; external?: boolean; children: ReactNode }) {
  return (
    <a href={href} className={styles.link} {...(external && { target: '_blank', rel: 'noreferrer' })}>
      {children}
    </a>
  );
}

/**
 * - owner: "A project by Chinmay Dubey" with Help, Privacy, Terms.
 * - viewer: the gate and public pages; says views and reading time are recorded.
 * - reader: the compact footer under the PDF reader.
 *
 * `before` and `after` add links around Help, Privacy and Terms (the landing page's sections and GitHub).
 */
export function AppFooter({
  variant = 'owner',
  before,
  after,
}: {
  variant?: Variant;
  before?: ReactNode;
  after?: ReactNode;
}) {
  if (variant === 'reader') {
    return (
      <footer className={styles.footer}>
        <div className={cx('container', styles.inner, styles.compact)}>
          <span className={styles.brand}>Tracked Links</span>
          <span>This document tracks views and reading time.</span>
          <Link to="/#privacy" className={styles.link}>
            What’s tracked
          </Link>
        </div>
      </footer>
    );
  }

  return (
    <footer className={styles.footer}>
      <div className={cx('container', styles.inner)}>
        <span className={styles.left}>
          <span className={styles.brand}>Tracked Links</span>
          <span className={styles.tagline}>
            {variant === 'viewer' ? 'Views and reading time are recorded' : 'A project by Chinmay Dubey'}
          </span>
        </span>
        <nav aria-label="Footer" className={styles.nav}>
          {before}
          <Link to="/help" className={styles.link}>
            Help
          </Link>
          <Link to="/privacy" className={styles.link}>
            Privacy
          </Link>
          <Link to="/terms" className={styles.link}>
            Terms
          </Link>
          {after}
        </nav>
      </div>
    </footer>
  );
}
