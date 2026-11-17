import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MAX_UPLOAD_BYTES, formatBytes, type DocumentSummary } from '@tracked-links/shared';
import { errorMessage, uploadDocument } from './api';

export type UploadState =
  | { status: 'idle' }
  | { status: 'preparing'; fileName: string }
  | { status: 'uploading'; fileName: string; progress: number }
  | { status: 'done'; document: DocumentSummary }
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

export function useDocumentUpload() {
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
        const document = await uploadDocument(file, thumbnail, (progress) =>
          setState({ status: 'uploading', fileName: file.name, progress }),
        );
        setState({ status: 'done', document });
        await queryClient.invalidateQueries({ queryKey: ['documents'] });
      } catch (error) {
        setState({ status: 'error', message: errorMessage(error) });
      }
    },
    [queryClient],
  );

  const busy = state.status === 'preparing' || state.status === 'uploading';
  return { state, start, busy };
}
