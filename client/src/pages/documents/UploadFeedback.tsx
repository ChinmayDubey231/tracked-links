import { ButtonLink } from '../../components/Button';
import type { UploadState } from '../../lib/upload';
import styles from './DocumentsPage.module.css';

/** Progress, success and error messages shown inside the dropzone. */
export function UploadFeedback({ state }: { state: UploadState }) {
  switch (state.status) {
    case 'idle':
      return null;

    case 'preparing':
      return <p className={styles.feedbackText}>Preparing {state.fileName}…</p>;

    case 'uploading': {
      const percent = Math.round(state.progress * 100);
      return (
        <div className={styles.progress}>
          <div className={styles.progressRow}>
            <span className={styles.feedbackText}>Uploading {state.fileName}…</span>
            <span className={styles.feedbackText} aria-hidden="true">
              {percent}%
            </span>
          </div>
          <div
            className={styles.track}
            role="progressbar"
            aria-label={`Uploading ${state.fileName}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className={styles.fill} style={{ width: `${percent}%` }} />
          </div>
        </div>
      );
    }

    case 'done':
      return (
        <div className={styles.success}>
          <span>Uploaded {state.document.title}. Next, make a link for each place you will share it.</span>
          <ButtonLink to={`/documents/${state.document.id}/links/new`} variant="primary">
            Create a share link
          </ButtonLink>
        </div>
      );

    case 'error':
      return <p className={styles.errorText}>{state.message}</p>;
  }
}
