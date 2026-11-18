import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './StatTile.module.css';

/**
 * A number plus a label. `md` is the analytics tile (20px number), `lg` the
 * Link views tile (28px number).
 */
export function StatTile({ value, label, size = 'md' }: { value: ReactNode; label: string; size?: 'md' | 'lg' }) {
  return (
    <div className={cx(styles.tile, styles[size])}>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
