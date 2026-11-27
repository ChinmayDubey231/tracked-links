import { useEffect, useState } from 'react';

interface PdfBlobState {
  blob: Blob | null;
  failed: boolean;
  /** Share of the file downloaded, 0 to 1. Null until known, or when the size isn't sent. */
  progress: number | null;
}

/** Reads the body in chunks to report progress. Falls back to a plain read when it can't. */
async function readWithProgress(response: Response, onProgress: (share: number) => void): Promise<Blob> {
  const total = Number(response.headers.get('Content-Length')) || 0;
  if (!response.body || total <= 0) return response.blob();

  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  let lastPercent = -1;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    // One update per whole percent keeps re-renders to at most a hundred.
    const percent = Math.min(100, Math.floor((received / total) * 100));
    if (percent !== lastPercent) {
      lastPercent = percent;
      onProgress(percent / 100);
    }
  }
  return new Blob(chunks, { type: response.headers.get('Content-Type') ?? 'application/pdf' });
}

/**
 * Downloads a PDF once, as a Blob: pdf.js then needs no further requests, so the
 * short-lived signed URL can expire while the document is on screen.
 */
export function usePdfBlob(url: string | null | undefined) {
  const [state, setState] = useState<PdfBlobState>({ blob: null, failed: false, progress: null });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`File request failed with ${response.status}`);
        return readWithProgress(response, (progress) => {
          if (!controller.signal.aborted) setState((old) => ({ ...old, progress }));
        });
      })
      .then((blob) => setState({ blob, failed: false, progress: 1 }))
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setState({ blob: null, failed: true, progress: null });
      });
    return () => controller.abort();
  }, [url]);
  return state;
}
