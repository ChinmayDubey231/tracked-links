import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Button } from './Button';
import styles from './States.module.css';

export function LoadingState({ label = 'Loading…', fullPage = false }: { label?: string; fullPage?: boolean }) {
  return (
    <div className={cx(styles.loading, fullPage && styles.fullPage)} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({
  title = "This page didn't load",
  message,
  onRetry,
  children,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className={styles.error} role="alert">
      <p className={styles.errorTitle}>{title}</p>
      <p className={styles.errorMessage}>{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
      {children}
    </div>
  );
}

/** A form-level error, announced when it appears. */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div className={styles.alert} role="alert">
      {children}
    </div>
  );
}
