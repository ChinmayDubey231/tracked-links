import { cx } from '../lib/cx';
import styles from './Meters.module.css';

const MAX_BLOCKS = 8;

interface PagesReachedMeterProps {
  reached: number;
  total: number;
  /** md: tables (9×13 blocks, 14px text). sm: compact rows such as the landing page (8×11, 13px). */
  size?: 'md' | 'sm';
  /** Show "4 of 4 pages" instead of "4 of 4". */
  withUnit?: boolean;
}

/**
 * One small block per page, filled when reached, followed by "3 of 4".
 * Above 8 pages it switches to a single progress bar.
 */
export function PagesReachedMeter({ reached, total, size = 'md', withUnit = false }: PagesReachedMeterProps) {
  const safeTotal = Math.max(total, 1);
  const safeReached = Math.min(Math.max(reached, 0), safeTotal);

  return (
    <span className={cx(styles.meter, size === 'sm' && styles.meterSmall)}>
      {safeTotal <= MAX_BLOCKS ? (
        <span className={styles.blocks} aria-hidden="true">
          {Array.from({ length: safeTotal }, (_, index) => (
            <span key={index} className={cx(styles.block, index < safeReached && styles.reached)} />
          ))}
        </span>
      ) : (
        <span className={styles.bar} aria-hidden="true">
          <span className={styles.barFill} style={{ width: `${(safeReached / safeTotal) * 100}%`, display: 'block' }} />
        </span>
      )}
      <span className={styles.meterText}>
        {safeReached} of {safeTotal}
        {withUnit ? ' pages' : <span className="visually-hidden"> pages</span>}
        <span className="visually-hidden"> reached</span>
      </span>
    </span>
  );
}
