import { extractReceiptFields, type ReceiptExtraction } from '@paytsek/receipt-parsers';
import { File } from 'expo-file-system';
import { ReceiptOcr, type OcrOutput } from 'receipt-ocr';

export type PreparedReceiptProof = {
  imageUri: string;
  ocr: OcrOutput;
  extraction: ReceiptExtraction;
};

/** Strip metadata, run on-device OCR once, and preserve structured provenance. */
export async function prepareReceiptProof(
  sourceUri: string,
  options: { fileName?: string | null; deleteSource?: boolean } = {},
): Promise<PreparedReceiptProof> {
  let cleanUri: string | null = null;
  try {
    const clean = await ReceiptOcr.stripMetadata(sourceUri);
    cleanUri = clean.uri;
    const ocr = await ReceiptOcr.recognize(clean.uri);
    return {
      imageUri: clean.uri,
      ocr,
      extraction: extractReceiptFields(ocr.fullText, ocr.blocks, { fileName: options.fileName }),
    };
  } catch (error) {
    // A prepared image only becomes durable after the scan flow saves it.
    // Do not leave failed OCR probes in the application cache.
    discardCaptureFile(cleanUri);
    throw error;
  } finally {
    if (options.deleteSource) discardCaptureFile(sourceUri);
  }
}

/** Only call for PayTsek-owned cache files, never the user's photo-library URI. */
export function discardCaptureFile(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch { /* Already removed or no longer accessible. */ }
}
