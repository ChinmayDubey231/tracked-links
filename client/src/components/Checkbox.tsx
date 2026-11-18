import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './Field.module.css';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  hint?: ReactNode;
}

/** A 22px checkbox with a bold label and a muted hint; the whole label is clickable. */
export function Checkbox({ label, hint, id, className, ...rest }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const titleId = `${inputId}-title`;
  const hintId = `${inputId}-hint`;

  return (
    <div className={cx(styles.checkRow, className)}>
      <input
        id={inputId}
        type="checkbox"
        className={styles.checkbox}
        aria-labelledby={titleId}
        aria-describedby={hint ? hintId : undefined}
        {...rest}
      />
      <label htmlFor={inputId} className={styles.checkLabel}>
        <span id={titleId} className={styles.checkTitle}>
          {label}
        </span>
        {hint && (
          <span id={hintId} className={styles.checkHint}>
            {hint}
          </span>
        )}
      </label>
    </div>
  );
}
