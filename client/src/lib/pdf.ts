import { pdfjs } from 'react-pdf';

// pdf.js parses PDFs in a web worker; Vite bundles the worker file from pdfjs-dist.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export { pdfjs };

/**
 * Renders page 1 of a local PDF to a PNG for the Documents list. Returns null if
 * the PDF can't be rendered: the upload still works, with a generic preview.
 */
export async function renderFirstPagePng(file: File, cssWidth = 240): Promise<Blob | null> {
  let loadingTask: ReturnType<typeof pdfjs.getDocument> | null = null;
  try {
    loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const scale = (cssWidth * 2) / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  } catch {
    return null;
  } finally {
    await loadingTask?.destroy();
  }
}
