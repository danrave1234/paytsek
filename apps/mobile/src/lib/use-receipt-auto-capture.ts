import { assessReceiptForAutoCapture } from '@paytsek/receipt-parsers';
import type { CameraView } from 'expo-camera';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { discardCaptureFile, prepareReceiptProof, type PreparedReceiptProof } from './receipt-capture';

export type AutoCaptureStatus = 'OFF' | 'LOOKING' | 'HOLD_STILL' | 'CAPTURING';

/**
 * Samples still frames locally because expo-camera has no frame processor.
 * A proof is accepted only after two consecutive OCR frames agree.
 */
export function useReceiptAutoCapture(options: {
  camera: CameraView | null;
  enabled: boolean;
  active: boolean;
  ready: boolean;
  blocked: boolean;
  operation: MutableRefObject<boolean>;
  onDetected: (proof: PreparedReceiptProof) => Promise<void>;
}): AutoCaptureStatus {
  const { camera, enabled, active, ready, blocked, operation, onDetected } = options;
  const [status, setStatus] = useState<AutoCaptureStatus>(enabled ? 'LOOKING' : 'OFF');
  const stable = useRef<{ fingerprint: string; at: number } | null>(null);

  useEffect(() => {
    if (!enabled || !camera || !active || !ready || blocked) {
      stable.current = null;
      setStatus(enabled ? 'LOOKING' : 'OFF');
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = (delay = 1800) => { if (!cancelled) timer = setTimeout(() => void sample(), delay); };
    const sample = async () => {
      if (operation.current) return schedule();
      operation.current = true;
      let prepared: PreparedReceiptProof | null = null;
      try {
        const photo = await camera.takePictureAsync({ quality: 0.82, skipProcessing: false, shutterSound: false });
        if (!photo?.uri || cancelled) return;
        prepared = await prepareReceiptProof(photo.uri, { deleteSource: true });
        if (cancelled) return;
        const assessment = assessReceiptForAutoCapture(prepared.extraction);
        const previous = stable.current;
        const now = Date.now();
        const confirmed = assessment.eligible && assessment.fingerprint && previous?.fingerprint === assessment.fingerprint && now - previous.at < 10_000;
        if (confirmed) {
          stable.current = null;
          setStatus('CAPTURING');
          const accepted = prepared;
          prepared = null;
          await onDetected(accepted);
        } else {
          stable.current = assessment.eligible && assessment.fingerprint ? { fingerprint: assessment.fingerprint, at: now } : null;
          setStatus(assessment.eligible ? 'HOLD_STILL' : 'LOOKING');
        }
      } catch {
        stable.current = null;
        if (!cancelled) setStatus('LOOKING');
      } finally {
        if (prepared) discardCaptureFile(prepared.imageUri);
        operation.current = false;
        schedule();
      }
    };
    schedule(800);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, blocked, camera, enabled, onDetected, operation, ready]);

  return status;
}
