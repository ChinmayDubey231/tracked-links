import { useCallback, useState } from 'react';

/**
 * The email typed on Log in or Sign up, shared so it is still there after switching between the two pages
 * (by the switch link or the browser's Back button). Memory only: a reload starts empty, and a successful
 * log in or sign up clears it. Passwords are never carried across.
 */
let draft = '';

/** Like useState for the email field, but starts from, and keeps updating, the shared draft. */
export function useDraftEmail() {
  const [email, setEmail] = useState(() => draft);
  const update = useCallback((value: string) => {
    draft = value;
    setEmail(value);
  }, []);
  return [email, update] as const;
}

export function clearDraftEmail() {
  draft = '';
}
