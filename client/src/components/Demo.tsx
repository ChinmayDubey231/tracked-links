import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cx } from '../lib/cx';
import { Button } from './Button';
import styles from './Demo.module.css';

/*
 * The demo: "Try the demo" starts a private copy of a sample account (server lib/demo.ts), with no
 * sign-up. It lasts 24 hours and can't upload files; everything else works.
 */

/** The signed-in account is a demo sandbox. */
export function useIsDemo(): boolean {
  return Boolean(useAuth().user?.demoExpiresAt);
}

/** After this long the button explains the wait: the API may be waking up on Render's free plan. */
const SLOW_AFTER_MS = 6000;

/** Starts a demo and opens its documents. Shows why it failed, or why it is slow, underneath. */
export function DemoButton({
  variant = 'secondary',
  size,
  block,
  className,
  buttonClassName,
}: {
  variant?: 'primary' | 'secondary';
  size?: 'md' | 'lg';
  block?: boolean;
  /** For the wrapper, which also holds the notes. */
  className?: string;
  buttonClassName?: string;
}) {
  const { startDemo } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
      setSlow(false);
    };
  }, [busy]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await startDemo();
      navigate('/documents');
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <span className={cx(styles.demoButton, block && styles.block, className)}>
      <Button
        variant={variant}
        size={size}
        block={block}
        loading={busy}
        className={buttonClassName}
        onClick={() => void start()}
      >
        {busy ? 'Starting the demo…' : 'Try the demo'}
      </Button>
      {slow && (
        <span className={styles.note} role="status">
          Waking the server. The first visit after a quiet spell can take up to a minute.
        </span>
      )}
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

function timeLeft(expiresAt: string): string {
  const hours = (new Date(expiresAt).getTime() - Date.now()) / 3_600_000;
  if (hours < 1) return 'within the hour';
  const rounded = Math.ceil(hours);
  return `in ${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
}

/** Leaves the demo for the sign-up form, which is only for signed-out visitors. */
function useSignUpFromDemo() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return () => {
    logout();
    navigate('/signup');
  };
}

/** The strip under the top bar on every owner screen during a demo. */
export function DemoBanner() {
  const { user } = useAuth();
  const signUp = useSignUpFromDemo();
  if (!user?.demoExpiresAt) return null;

  return (
    <aside className={styles.banner} aria-label="Demo account">
      <div className={cx('container', styles.bannerInner)}>
        <p className={styles.bannerText}>
          <strong>This is a demo account</strong> with fictional documents. Make links and open them in a private window
          to see visits tracked. It’s deleted {timeLeft(user.demoExpiresAt)}.
        </p>
        <button type="button" className={styles.bannerAction} onClick={signUp}>
          Create your own account
        </button>
      </div>
    </aside>
  );
}

/** Stands in for the upload area during a demo. */
export function DemoUploadNotice() {
  const signUp = useSignUpFromDemo();
  return (
    <section className={styles.notice} aria-labelledby="demo-upload-title">
      <div className={styles.noticeBody}>
        <h2 id="demo-upload-title" className={styles.noticeTitle}>
          Uploading is off in the demo
        </h2>
        <p className={styles.noticeText}>
          These sample documents are fictional. Create a free account to upload and track your own PDFs.
        </p>
      </div>
      <Button variant="secondary" onClick={signUp}>
        Create an account
      </Button>
    </section>
  );
}
