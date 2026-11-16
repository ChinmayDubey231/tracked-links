import { PDFDocument } from 'pdf-lib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Checks file content, not the name or the browser-supplied type. The PDF spec
 * allows the "%PDF-" header anywhere in the first 1024 bytes.
 */
export function looksLikePdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 1024).includes('%PDF-', 0, 'latin1');
}

export function isPng(buffer: Buffer): boolean {
  return buffer.length > PNG_SIGNATURE.length && buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

/** Parses the PDF to confirm it is readable and count its pages. Throws if it cannot be parsed. */
export async function readPdfInfo(buffer: Buffer): Promise<{ pageCount: number }> {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
  const pageCount = pdf.getPageCount();
  if (pageCount < 1) throw new Error('PDF has no pages');
  return { pageCount };
}

/** Tidies a file name for use as a document title: no control characters, single spaces, at most 200 characters. */
export function cleanTitle(raw: string): string {
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'Untitled.pdf').slice(0, 200);
}
