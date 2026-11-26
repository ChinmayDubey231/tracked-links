import { useRef } from 'react';
import { countLabel } from '@tracked-links/shared';
import { Button } from '../../components/Button';
import { cx } from '../../lib/cx';
import type { UploadState } from '../../lib/upload';
import styles from './DocumentPage.module.css';
import headStyles from './DocumentsPage.module.css';

/** "Replace file" in the sub-header: opens the file picker, then hands the chosen PDF on. */
export function ReplaceFileButton({ busy, onFile }: { busy: boolean; onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = ''; // Choosing the same file again still triggers a change.
          if (file) onFile(file);
        }}
      />
      <Button variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Replacing…' : 'Replace file'}
      </Button>
    </>
  );
}

/**
 * Progress, then the outcome of replacing the file. Links keep their addresses and the
 * document keeps its title, so the message says what readers will see now.
 */
export function ReplaceStatus({
  state,
  title,
  pagesBefore,
  onDismiss,
}: {
  state: UploadState;
  title: string;
  /** The page count before the replace, to say when it changed. */
  pagesBefore: number | null;
  onDismiss: () => void;
}) {
  if (state.status === 'idle') return null;

  if (state.status === 'preparing' || state.status === 'uploading') {
    const percent = state.status === 'uploading' ? Math.round(state.progress * 100) : 0;
    return (
      <div className={styles.replaceNotice} role="status">
        <div className={headStyles.progress}>
          <div className={headStyles.progressRow}>
            <span className={headStyles.feedbackText}>
              {state.status === 'preparing' ? `Preparing ${state.fileName}…` : `Uploading ${state.fileName}…`}
            </span>
            <span className={headStyles.feedbackText} aria-hidden="true">
              {percent}%
            </span>
          </div>
          <div
            className={headStyles.track}
            role="progressbar"
            aria-label={`Uploading ${state.fileName}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className={headStyles.fill} style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={cx(styles.replaceNotice, styles.replaceError)} role="alert">
        <p className={headStyles.errorText}>The file wasn’t replaced. {state.message}</p>
        <Button variant="secondary" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    );
  }

  const { document } = state;
  const pagesChanged = pagesBefore !== null && pagesBefore !== document.pageCount;
  return (
    <div className={styles.replaceNotice} role="status">
      <p className={styles.replaceText}>
        <strong>File replaced with {state.fileName}.</strong>
        {` Every link you have shared now opens it, still titled “${title}”.`}
        {pagesChanged &&
          ` It has ${countLabel(document.pageCount, 'page')} instead of ${pagesBefore}; earlier views keep the pages they read.`}
      </p>
      <Button variant="secondary" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
