import { Link, NavLink } from 'react-router';
import { useAuth } from '../lib/auth';
import { cx } from '../lib/cx';
import { AccountMenu } from './AccountMenu';
import { LogoMark } from './LogoMark';
import styles from './TopBar.module.css';

/** Owner top bar: logo and wordmark, the Documents tab and the account button. */
export function TopBar() {
  const { user, logout } = useAuth();
  return (
    <header className={styles.header}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <div className={cx('container', styles.inner)}>
        <Link to="/documents" className={styles.brand}>
          <LogoMark />
          Tracked Links
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          {/* Every owner screen sits under Documents, so the tab always shows as current. */}
          <NavLink to="/documents" className={styles.tab}>
            Documents
          </NavLink>
          <AccountMenu user={user} onLogout={logout} />
        </nav>
      </div>
    </header>
  );
}
