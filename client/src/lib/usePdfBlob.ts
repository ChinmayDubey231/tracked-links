import { useEffect, useState } from 'react';

/**
 * Downloads a PDF once, as a Blob: pdf.js then needs no further requests, so the
 * short-lived signed URL can expire while the document is on screen.
 */
export function usePdfBlob(url: string | null | undefined) {
  const [state, setState] = useState<{ blob: Blob | null; failed: boolean }>({ blob: null, failed: false });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`File request failed with ${response.status}`);
        return response.blob();
      })
      .then((blob) => setState({ blob, failed: false }))
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setState({ blob: null, failed: true });
      });
    return () => controller.abort();
  }, [url]);
  return state;
}
