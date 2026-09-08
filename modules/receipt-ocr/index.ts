import { requireNativeModule } from 'expo-modules-core';

/**
 * On-device OCR via ML Kit Text Recognition v2 (Latin). No network, no LLM,
 * no paid cloud OCR for normal scans. The Android model is bundled for
 * predictable first-use behavior; on iOS ML Kit bundles the model by default.
 */
export interface OcrBlock {
  text: string;
  confidence: number | null;
  /** Normalized [x, y, w, h] in 0..1 image coordinates. */
  box: [number, number, number, number] | null;
}

export interface OcrOutput {
  engine: 'MLKIT_TEXT_V2';
  engineVersion: string;
  fullText: string;
  blocks: OcrBlock[];
  imageWidth: number;
  imageHeight: number;
}

export interface SharedImage {
  /** file:// URI inside the App Group container (iOS) or app cache (Android). */
  uri: string;
  contentType: string;
  receivedAt: string;
}

interface NativeModule {
  recognize(fileUri: string): Promise<OcrOutput>;
  /** Re-encode the image without EXIF/GPS metadata; returns the new file URI and byte length. */
  stripMetadata(fileUri: string, quality: number): Promise<{ uri: string; byteLength: number; contentType: string }>;
  /** iOS: images staged by the share extension in the App Group container. Android returns []. */
  drainSharedInbox(): Promise<SharedImage[]>;
}

const native = requireNativeModule<NativeModule>('ReceiptOcr');

export const ReceiptOcr = {
  recognize: (fileUri: string): Promise<OcrOutput> => native.recognize(fileUri),
  stripMetadata: (fileUri: string, quality = 0.92): Promise<{ uri: string; byteLength: number; contentType: string }> => native.stripMetadata(fileUri, quality),
  drainSharedInbox: (): Promise<SharedImage[]> => native.drainSharedInbox(),
};
