import { useEffect } from 'react';

/** Sets the browser tab title as "<page> · Tracked Links". */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Tracked Links` : 'Tracked Links';
  }, [title]);
}
