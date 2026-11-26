import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MAX_UPLOAD_BYTES, formatBytes, type DocumentSummary } from '@tracked-links/shared';
import { errorMessage, replaceDocumentFile, uploadDocument, type UploadProgress } from './api';

export type UploadState =
  | { status: 'idle' }
  | { status: 'preparing'; fileName: string }
  | { status: 'uploading'; fileName: string; progress: number }
  | { status: 'done'; fileName: string; document: DocumentSummary }
  | { status: 'error'; message: string };

/** Quick checks before uploading. The server checks the file content again. */
export function validatePdfFile(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return `"${file.name}" isn't a PDF. Choose a file that ends in .pdf.`;
  if (file.size === 0) return `"${file.name}" is empty. Choose another file.`;
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)}. The limit is 10 MB: compress the PDF or export a smaller version, then try again.`;
  }
  return null;
}

type SendPdf = (file: File, thumbnail: Blob | null, onProgress: UploadProgress) => Promise<DocumentSummary>;

/** Check the file, render its first page as the thumbnail, send it with progress, then refresh the documents. */
function usePdfSend(send: SendPdf) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<UploadState>({ status: 'idle' });

  const start = useCallback(
    async (file: File) => {
      const problem = validatePdfFile(file);
      if (problem) {
        setState({ status: 'error', message: problem });
        return;
      }

      setState({ status: 'preparing', fileName: file.name });
      // Loaded on demand so pdf.js stays out of the first page load.
      const { renderFirstPagePng } = await import('./pdf');
      const thumbnail = await renderFirstPagePng(file);

      setState({ status: 'uploading', fileName: file.name, progress: 0 });
      try {
        const document = await send(file, thumbnail, (progress) =>
          setState({ status: 'uploading', fileName: file.name, progress }),
        );
        setState({ status: 'done', fileName: file.name, document });
        await queryClient.invalidateQueries({ queryKey: ['documents'] });
      } catch (error) {
        setState({ status: 'error', message: errorMessage(error) });
      }
    },
    [queryClient, send],
  );

  const reset = useCallback(() => setState({ status: 'idle' }), []);
  const busy = state.status === 'preparing' || state.status === 'uploading';
  return { state, start, reset, busy };
}

export function useDocumentUpload() {
  return usePdfSend(uploadDocument);
}

/** Replacing a document's file: same checks and progress as an upload. */
export function useFileReplace(documentId: string | undefined) {
  const send = useCallback<SendPdf>(
    (file, thumbnail, onProgress) => {
      if (!documentId) return Promise.reject(new Error('No document to replace'));
      return replaceDocumentFile(documentId, file, thumbnail, onProgress);
    },
    [documentId],
  );
  return usePdfSend(send);
}
