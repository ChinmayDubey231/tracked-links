import { useImperativeHandle, useRef, useState, type DragEvent, type ReactNode, type Ref } from 'react';
import { cx } from '../lib/cx';
import { Button } from './Button';
import styles from './UploadDropzone.module.css';

export interface UploadDropzoneHandle {
  /** Opens the file picker, for upload buttons elsewhere on the page. */
  open: () => void;
}

interface UploadDropzoneProps {
  /** compact: one row (Documents). hero: large centred block (first run). */
  variant?: 'compact' | 'hero';
  onFile: (file: File) => void;
  busy?: boolean;
  /** Progress, success or error content, announced to screen readers. */
  feedback?: ReactNode;
  ref?: Ref<UploadDropzoneHandle>;
}

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 20h16" />
    </svg>
  );
}

/** Drag-and-drop target plus a "Choose file" button. Dropping is an enhancement; the button always works. */
export function UploadDropzone({ variant = 'compact', onFile, busy = false, feedback, ref }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  useImperativeHandle(ref, () => ({ open: () => inputRef.current?.click() }), []);

  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (file && !busy) onFile(file);
  };

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes('Files');

  return (
    <div
      className={cx(styles.zone, styles[variant], dragging && styles.dragging)}
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        take(event.dataTransfer.files);
      }}
    >
      {variant === 'hero' && (
        <span className={styles.icon}>
          <UploadIcon />
        </span>
      )}
      <div className={styles.text}>
        <span className={styles.title}>Drop a PDF here to upload it</span>
        <span className={styles.hint}>
          {variant === 'hero' ? 'PDF only, up to 10 MB.' : 'PDF only, up to 10 MB. You can create share links right after.'}
        </span>
      </div>
      <Button
        variant={variant === 'hero' ? 'primary' : 'secondary'}
        size={variant === 'hero' ? 'lg' : 'md'}
        loading={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Uploading…' : 'Choose file'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          take(event.target.files);
          event.target.value = '';
        }}
      />
      <div className={styles.feedback} aria-live="polite">
        {feedback}
      </div>
    </div>
  );
}
