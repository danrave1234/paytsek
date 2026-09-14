import type { CaptureOrigin, OcrResult, ReceiptFields } from '@paytsek/contracts';
import { extractReceiptFields, parseMoneyExact, type ReceiptExtraction } from '@paytsek/receipt-parsers';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import { ReceiptOcr } from 'receipt-ocr';
import { CaptureSurface } from '@/components/capture-surface';
import { Notice, Screen, ScreenTitle } from '@/components/ui';
import { APP_VERSION } from '@/lib/env';
import { newId } from '@/lib/device';
import { saveDraft, stageImage, syncDraft, type Draft } from '@/lib/drafts';
import { useHome, useInvalidateRecord } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { RADIUS, SPACING, TOUCH_TARGET } from '@/theme';

type Stage = 'capture' | 'processing' | 'review' | 'saved';

export default function Scan() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string; uri?: string }>();
  const { workspace } = useSession();
  const home = useHome();
  const invalidate = useInvalidateRecord();
  const [permission, requestPermission] = useCameraPermissions();
  const [camera, setCamera] = useState<CameraView | null>(null);
  const [stage, setStage] = useState<Stage>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [origin, setOrigin] = useState<CaptureOrigin>('CAMERA');
  const [extraction, setExtraction] = useState<ReceiptExtraction | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrBlocks, setOcrBlocks] = useState<OcrResult['blocks']>([]);
  const [fields, setFields] = useState<ReceiptFields | null>(null);
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [torch, setTorch] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const saveLock = useRef(false);
  const operation = useRef(false);
  const resetOnNextFocus = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      if (state !== 'active') { setTorch(false); setCameraReady(false); }
    });
    return () => subscription.remove();
  }, []);

  const reset = useCallback(() => {
    setStage('capture');
    setImageUri(null);
    setExtraction(null);
    setOcrText('');
    setOcrBlocks([]);
    setFields(null);
    setAmountText('');
    setSaved(null);
    setError(null);
    saveLock.current = false;
  }, []);

  useFocusEffect(useCallback(() => {
    if (resetOnNextFocus.current) {
      resetOnNextFocus.current = false;
      reset();
    }
    setFocused(true);
    return () => { setFocused(false); setTorch(false); setCameraReady(false); };
  }, [reset]));

  const persist = useCallback(async (
    receipt: ReceiptExtraction,
    uri: string,
    from: CaptureOrigin,
    corrected: ReceiptFields = receipt.fields,
    rawOcrText: string = ocrText,
    rawOcrBlocks: OcrResult['blocks'] = ocrBlocks,
  ) => {
    if (!workspace || !corrected.amountCentavos || saveLock.current) return false;

    saveLock.current = true;
    setError(null);
    const clientRecordId = newId();
    try {
      const stagedUri = await stageImage(uri, clientRecordId, 'jpg');
      const finalFields = { ...corrected, amountCentavos: corrected.amountCentavos, currency: 'PHP' as const };
      const draft = await saveDraft({
        clientRecordId,
        workspaceId: workspace.id,
        imageUri: stagedUri,
        contentType: 'image/jpeg',
        request: {
          clientRecordId,
          // Notification listening is optional evidence. The server attaches a
          // receiving source later only when a notification is actually chosen.
          sourceId: null,
          proofId: null,
          captureOrigin: from,
          capturedAt: new Date().toISOString(),
          appVersion: APP_VERSION,
          receiptParserId: receipt.parserId,
          receiptParserVersion: receipt.parserVersion,
          ocr: {
            engine: 'MLKIT_TEXT_V2',
            engineVersion: 'mlkit',
            fullText: rawOcrText.slice(0, 20000),
            blocks: rawOcrBlocks.slice(0, 500),
            readabilityScore: receipt.readabilityScore,
            providerDetection: receipt.providerDetection,
          },
          extracted: receipt.fields,
          corrected: finalFields,
          editedFields: [],
          customerLabel: null,
          note: null,
        },
      });

      // Local persistence is success. Navigation never waits for image upload,
      // record creation, matching, or any other backend acknowledgement.
      setSaved(draft);
      setStage('saved');
      resetOnNextFocus.current = true;
      router.replace({
        pathname: '/(tabs)',
        params: {
          savedAmount: String(finalFields.amountCentavos),
          savedProvider: finalFields.receiptProvider ?? '',
        },
      });
      void syncDraft(draft).then(() => invalidate()).catch(() => undefined);
      return true;
    } catch {
      saveLock.current = false;
      // Native/database details are not actionable and should never occupy the
      // payment flow. Keep the captured proof on screen so retry is one tap.
      setError('Could not save the proof on this phone. Keep this screen open and try again.');
      return false;
    }
  }, [invalidate, ocrBlocks, ocrText, router, workspace]);

  const processImage = useCallback(async (uri: string, from: CaptureOrigin, fileName?: string | null) => {
    setStage('processing');
    setImageUri(uri);
    setError(null);
    setOrigin(from);
    try {
      const clean = await ReceiptOcr.stripMetadata(uri, 0.92);
      setImageUri(clean.uri);
      const ocr = await ReceiptOcr.recognize(clean.uri);
      setOcrText(ocr.fullText);
      setOcrBlocks(ocr.blocks);
      const receipt = extractReceiptFields(ocr.fullText, ocr.blocks, { fileName });
      setExtraction(receipt);
      setFields(receipt.fields);
      setAmountText(receipt.fields.amountCentavos ? (receipt.fields.amountCentavos / 100).toFixed(2) : '');

      // A receipt proof is valuable on its own. As soon as OCR finds an amount,
      // keep it locally and let matching happen later in the background.
      if (receipt.fields.amountCentavos && await persist(receipt, clean.uri, from, receipt.fields, ocr.fullText, ocr.blocks)) return;
      setStage('review');
    } catch {
      setError('Could not read the proof. Try again or import a screenshot.');
      setStage('capture');
    }
  }, [persist]);

  useEffect(() => {
    if (params.source !== 'share') return;
    void (async () => {
      if (params.uri) return processImage(params.uri, 'SHARE_SHEET');
      const shared = await ReceiptOcr.drainSharedInbox();
      if (shared[0]) await processImage(shared[0].uri, 'SHARE_SHEET');
    })();
  }, [params.source, params.uri, processImage]);

  const capture = useCallback(async () => {
    if (!camera || !cameraReady || operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      const photo = await camera.takePictureAsync({ quality: 0.9, skipProcessing: false });
      if (photo?.uri) await processImage(photo.uri, 'CAMERA');
    } catch {
      setError('Could not capture the proof.');
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }, [camera, cameraReady, processImage]);

  const pick = useCallback(async () => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (!result.canceled && result.assets[0]) await processImage(result.assets[0].uri, 'IMAGE_IMPORT', result.assets[0].fileName);
    } catch {
      setError('Could not import the image.');
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }, [processImage]);

  const saveReview = async () => {
    if (!fields || !extraction || !imageUri) return;
    const amount = parseMoneyExact(amountText.trim());
    if (!amount) return setError('Check the amount.');
    const corrected: ReceiptFields = { ...fields, amountCentavos: amount.centavos, currency: 'PHP' };
    await persist(extraction, imageUri, origin, corrected);
  };

  if (stage === 'processing') {
    return (
      <Screen scroll={false} tabbed style={styles.processingPage}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.processingImage} resizeMode="contain" accessibilityLabel="Captured payment proof" /> : null}
        <View style={[styles.processingIndicator, { backgroundColor: theme.colors.surface }]} accessibilityLiveRegion="polite">
          <ActivityIndicator color={theme.colors.primary} />
          <Text variant="labelLarge">Reading proof</Text>
        </View>
      </Screen>
    );
  }

  if (stage === 'saved' && saved) {
    return <Screen scroll={false} tabbed style={styles.center}><ActivityIndicator color={theme.colors.primary} /></Screen>;
  }

  if (stage === 'review' && fields && extraction) {
    return (
      <Screen tabbed>
        <ScreenTitle title="Confirm amount" />
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" accessibilityLabel="Captured payment proof" /> : null}
        <Notice kind="info">We’ll save the proof now. You can edit details later.</Notice>
        <TextInput label="Amount" mode="outlined" keyboardType="decimal-pad" value={amountText} onChangeText={setAmountText} right={<TextInput.Affix text="₱" />} />
        {error ? <Notice kind="error">{error}</Notice> : null}
        <Button mode="contained" onPress={() => void saveReview()} disabled={saveLock.current} style={{ minHeight: TOUCH_TARGET }}>Save proof</Button>
        <Button onPress={reset}>Retake</Button>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} tabbed style={styles.page}>
      <View style={styles.header}>
        <View>
          <ScreenTitle title="Scan proof" />
          <View style={styles.sourceHealth}>
            <View
              style={[
                styles.healthDot,
                { backgroundColor: home.data?.collectors.some((collector) => !collector.stale) ? '#12B76A' : theme.colors.outline },
              ]}
            />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {home.data?.collectors.some((collector) => !collector.stale)
                ? 'Wallet evidence ready'
                : 'Wallet evidence is optional'}
            </Text>
          </View>
        </View>
        <IconButton icon="account-circle-outline" accessibilityLabel="Open settings" onPress={() => router.navigate('/(tabs)/settings')} />
      </View>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <CaptureSurface
        granted={!!permission?.granted}
        canAskAgain={permission?.canAskAgain !== false}
        active={focused && foreground}
        ready={cameraReady}
        busy={busy}
        cameraRef={setCamera}
        onReady={() => setCameraReady(true)}
        torch={torch}
        onTorch={() => setTorch((value) => !value)}
        onPermission={() => void requestPermission()}
        onCapture={capture}
        onImport={pick}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, gap: SPACING.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  processingPage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  processingImage: { width: '100%', height: '82%', borderRadius: RADIUS.lg, backgroundColor: '#000000' },
  processingIndicator: { position: 'absolute', bottom: 128, minHeight: 48, borderRadius: RADIUS.full, paddingHorizontal: SPACING.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  preview: { width: '100%', height: 210, borderRadius: RADIUS.lg, backgroundColor: '#000000' },
  sourceHealth: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: -SPACING.xs },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
});
