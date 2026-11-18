import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cx } from '../lib/cx';
import styles from './Button.module.css';

interface StyleProps {
  /** primary: brand fill. secondary: white with an ink border. */
  variant?: 'primary' | 'secondary';
  /** md is 44px tall, lg is 48px. */
  size?: 'md' | 'lg';
  block?: boolean;
}

function classes({ variant = 'primary', size = 'md', block }: StyleProps, className?: string) {
  return cx(styles.button, styles[variant], size === 'lg' && styles.lg, block && styles.block, className);
}

export function Button({
  variant,
  size,
  block,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: StyleProps & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type={type}
      className={classes({ variant, size, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}

/** A router link styled as a button. */
export function ButtonLink({ variant, size, block, className, ...rest }: StyleProps & LinkProps) {
  return <Link className={classes({ variant, size, block }, className)} {...rest} />;
}
