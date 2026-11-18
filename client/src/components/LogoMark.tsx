import chainLinks from '../assets/brand/chain-links.svg';
import risingAnalytics from '../assets/brand/rising-analytics.svg';
import styles from './LogoMark.module.css';

/**
 * The app icon from Figma ("Tracked Links / App icon"): chain links with rising bars,
 * in a 24px box. Decorative: always next to the wordmark.
 */
export function LogoMark() {
  return (
    <span className={styles.mark} aria-hidden="true">
      <img src={chainLinks} alt="" width="19.65" height="20.05" className={styles.chain} />
      <img src={risingAnalytics} alt="" width="7.8" height="7.3" className={styles.bars} />
    </span>
  );
}
