import { cx } from '../lib/cx';
import styles from './Meters.module.css';

/**
 * 3px bar under a page thumbnail: the share of views that reached the page (0 to 1).
 * `fillClassName` is an extra class for the filled part, e.g. to animate it growing.
 */
export function ReachBar({ value, fillClassName }: { value: number; fillClassName?: string }) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <span className={styles.reachTrack} aria-hidden="true">
      <span className={cx(styles.reachFill, fillClassName)} style={{ width: `${percent}%` }} />
    </span>
  );
}
