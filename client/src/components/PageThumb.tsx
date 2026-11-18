import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './PageThumb.module.css';

interface PageThumbProps {
  /** A rendered page image URL, or a node such as a react-pdf <Page>. */
  image?: string | ReactNode | null;
  /** Heat overlay opacity, 0 to 0.6. Omit for no overlay. */
  opacity?: number;
  alt?: string;
  className?: string;
  /** Extra class for the heat overlay, e.g. to animate it in. */
  overlayClassName?: string;
}

/** A PDF page at A4 proportions with an optional red heat overlay. Fills its container's width. */
export function PageThumb({ image, opacity, alt = '', className, overlayClassName }: PageThumbProps) {
  let content: ReactNode;
  if (typeof image === 'string') {
    content = <img src={image} alt={alt} className={styles.image} loading="lazy" decoding="async" />;
  } else if (image) {
    content = <div className={styles.content}>{image}</div>;
  } else {
    content = <PagePlaceholder />;
  }

  return (
    <div className={cx(styles.thumb, className)}>
      {content}
      {opacity !== undefined && (
        <span className={cx(styles.heat, overlayClassName)} style={{ opacity }} aria-hidden="true" />
      )}
    </div>
  );
}

export function PagePlaceholder() {
  return (
    <span className={styles.placeholder} aria-hidden="true">
      <span className={styles.heading} />
      <span className={styles.accent} />
      <span style={{ width: '100%' }} />
      <span style={{ width: '86%' }} />
      <span className={styles.accent} />
      <span style={{ width: '100%' }} />
      <span style={{ width: '92%' }} />
      <span style={{ width: '70%' }} />
    </span>
  );
}
