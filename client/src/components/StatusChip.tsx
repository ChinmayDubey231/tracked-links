import { readingLabel, type LinkReading } from '@tracked-links/shared';
import { cx } from '../lib/cx';
import styles from './StatusChip.module.css';

export type LinkStatus = 'active' | 'expired' | 'off';

const LABELS: Record<LinkStatus, string> = { active: 'Active', expired: 'Expired', off: 'Off' };

/** sm: inside lists (12px). md: on its own, as in tables and headlines (13px). */
type ChipSize = 'sm' | 'md';

/** Whether a link can be opened: Active, Expired or Off. */
export function StatusChip({ status, size = 'md' }: { status: LinkStatus; size?: ChipSize }) {
  return <span className={cx(styles.chip, styles[size], styles[status])}>{LABELS[status]}</span>;
}

/** How far the link's latest reader got: "Read in full", "Stopped at page 2" or "Not opened". */
export function ReadingChip({ reading, size = 'md' }: { reading: LinkReading; size?: ChipSize }) {
  return <span className={cx(styles.chip, styles[size], styles[reading.state])}>{readingLabel(reading)}</span>;
}
