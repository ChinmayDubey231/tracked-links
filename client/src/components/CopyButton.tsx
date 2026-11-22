import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';

type CopyState = 'idle' | 'copied' | 'failed';

/** Copies `text` to the clipboard and says so for a few seconds, also to screen readers. */
export function CopyButton({
  text,
  label = 'Copy',
  variant = 'secondary',
}: {
  text: string;
  label?: string;
  variant?: 'primary' | 'secondary';
}) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      // Clipboard blocked (insecure origin, permissions): the address stays visible to copy by hand.
      setState('failed');
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 3000);
  };

  return (
    <>
      <Button variant={variant} onClick={() => void copy()}>
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
      </Button>
      <span className="visually-hidden" role="status">
        {state === 'copied' ? 'Link copied to the clipboard.' : state === 'failed' ? 'Copying failed. Select the address and copy it.' : ''}
      </span>
    </>
  );
}
