import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './Field.module.css';

interface DateFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
}

/** A labelled date input. The label and hint sit to the left and wrap above on narrow screens. */
export function DateField({ label, hint, error, id, className, ...rest }: DateFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx(styles.dateRow, className)}>
      <span className={styles.dateLabel}>
        <label htmlFor={inputId} className={styles.checkTitle}>
          {label}
        </label>
        {hint && (
          <span id={hintId} className={styles.checkHint}>
            {hint}
          </span>
        )}
      </span>
      <input
        id={inputId}
        type="date"
        className={cx(styles.dateInput, error && styles.invalid)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error && (
        <span id={errorId} className={cx(styles.error, styles.dateError)}>
          {error}
        </span>
      )}
    </div>
  );
}
