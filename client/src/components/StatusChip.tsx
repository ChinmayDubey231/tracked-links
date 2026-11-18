import { cx } from '../lib/cx';
import styles from './StatusChip.module.css';

export type LinkStatus = 'active' | 'expired' | 'off';

const LABELS: Record<LinkStatus, string> = { active: 'Active', expired: 'Expired', off: 'Off' };

export function StatusChip({ status }: { status: LinkStatus }) {
  return <span className={cx(styles.chip, styles[status])}>{LABELS[status]}</span>;
}
