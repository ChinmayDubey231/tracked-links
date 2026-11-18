import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from '@tracked-links/shared';

export type FieldErrors = Partial<Record<'name' | 'email' | 'password', string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function checkEmail(email: string): string | undefined {
  if (!email.trim()) return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address, like you@example.com.';
  return undefined;
}

export function checkNewPassword(password: string): string | undefined {
  if (!password) return 'Enter a password.';
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return 'Use a password of 72 characters or fewer.';
  return undefined;
}

/** Drops empty entries so `Object.keys(errors).length` means "has errors". */
export function compact(errors: FieldErrors): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, value]) => Boolean(value))) as FieldErrors;
}

/** Moves focus to the first field with an error, in form order. */
export function focusFirstError(errors: FieldErrors, ids: Record<keyof FieldErrors, string | undefined>) {
  for (const key of ['name', 'email', 'password'] as const) {
    const id = ids[key];
    if (errors[key] && id) {
      document.getElementById(id)?.focus();
      return;
    }
  }
}
