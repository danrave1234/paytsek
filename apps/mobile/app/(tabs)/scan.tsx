import type { CaptureOrigin, ReceiptFields } from '@paytsek/contracts';
import { extractReceiptFields, parseMoneyExact, type ReceiptExtraction } from '@paytsek/receipt-parsers';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, StyleSheet, View } from 'react-native';
import { Button, IconButton, TextInput, useTheme } from 'react-native-paper';
import { ReceiptOcr } from 'receipt-ocr';
import { CaptureSurface } from '@/components/capture-surface';
import { Notice, Screen, ScreenTitle } from '@/components/ui';
import { APP_VERSION } from '@/lib/env';
import { newId } from '@/lib/device';
import { saveDraft, stageImage, syncDraft, type Draft } from '@/lib/drafts';
import { useInvalidateRecord, useSources } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { RADIUS, SPACING, TOUCH_TARGET } from '@/theme';

type Stage = 'capture' | 'processing' | 'review' | 'saved';

function namespaceFor(fields: ReceiptFields) {
  if (fields.receiptProvider === 'GOTYME') return 'GOTYME_REF_NO' as const;
  if (fields.receiptProvider === 'MAYA') return 'MAYA_REF_NO' as const;
  if (fields.receiptProvider === 'MARIBANK') return 'MARIBANK_REF_NO' as const;
  return 'GCASH_REF_NO' as const;
}

export default function Scan() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string; uri?: string }>();
  const { workspace } = useSession();
  const sources = useSources();
  const invalidate = useInvalidateRecord();
  const [permission, requestPermission] = useCameraPermissions();
  const [camera, setCamera] = useState<CameraView | null>(null);
  const [stage, setStage] = useState<Stage>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [origin, setOrigin] = useState<CaptureOrigin>('CAMERA');
  const [extraction, setExtraction] = useState<ReceiptExtraction | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [fields, setFields] = useState<ReceiptFields | null>(null);
  const [amountText, setAmountText] = useState('');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [torch, setTorch] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const saveLock = useRef(false);
  const operation = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      if (state !== 'active') { setTorch(false); setCameraReady(false); }
    });
    return () => subscription.remove();
  }, []);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => { setFocused(false); setTorch(false); setCameraReady(false); };
  }, []));

  useEffect(() => {
    if (!sourceId && sources.data?.length) {
      setSourceId(sources.data.find((source) => source.isDefault)?.id ?? sources.data[0]!.id);
    }
  }, [sourceId, sources.data]);

  const reset = useCallback(() => {
    setStage('capture');
    setImageUri(null);
    setExtraction(null);
    setFields(null);
    setAmountText('');
    setSaved(null);
    setError(null);
    saveLock.current = false;
  }, []);

  const persist = useCallback(async (
    receipt: ReceiptExtraction,
    uri: string,
    from: CaptureOrigin,
    corrected: ReceiptFields = receipt.fields,
    rawOcrText: string = ocrText,
  ) => {
    const activeSourceId = sourceId ?? sources.data?.find((source) => source.isDefault)?.id ?? sources.data?.[0]?.id;
    if (!workspace || !activeSourceId || !corrected.amountCentavos || saveLock.current) return false;

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
          sourceId: activeSourceId,
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
            blocks: [],
            readabilityScore: receipt.readabilityScore,
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
      router.replace({ pathname: '/(tabs)', params: { savedAmount: String(finalFields.amountCentavos) } });
      void syncDraft(draft).then(() => invalidate()).catch(() => undefined);
      return true;
    } catch (saveError) {
      saveLock.current = false;
      setError((saveError as Error).message);
      return false;
    }
  }, [invalidate, ocrText, router, sourceId, sources.data, workspace]);

  const processImage = useCallback(async (uri: string, from: CaptureOrigin, automatic = false) => {
    if (!automatic) setStage('processing');
    setImageUri(uri);
    setError(null);
    setOrigin(from);
    try {
      const clean = await ReceiptOcr.stripMetadata(uri, 0.92);
      setImageUri(clean.uri);
      const ocr = await ReceiptOcr.recognize(clean.uri);
      setOcrText(ocr.fullText);
      const receipt = extractReceiptFields(ocr.fullText);
      setExtraction(receipt);
      setFields(receipt.fields);
      setAmountText(receipt.fields.amountCentavos ? (receipt.fields.amountCentavos / 100).toFixed(2) : '');

      const confident = Boolean(
        receipt.fields.amountCentavos
        && receipt.fields.referenceValue
        && receipt.fields.receiptProvider
        && receipt.fields.receiptStatus !== 'FAILED'
        && receipt.fields.receiptStatus !== 'PENDING',
      );
      const sourceAvailable = Boolean(sourceId ?? sources.data?.[0]?.id);
      if (confident && sourceAvailable && await persist(receipt, clean.uri, from, receipt.fields, ocr.fullText)) return;
      if (automatic && (!confident || sourceAvailable)) {
        reset();
        return;
      }
      setStage('review');
    } catch {
      if (automatic) {
        reset();
        return;
      }
      setError('Could not read the proof. Try again or import a screenshot.');
      setStage('capture');
    }
  }, [persist, reset, sourceId, sources.data]);

  useEffect(() => {
    if (params.source !== 'share') return;
    void (async () => {
      if (params.uri) return processImage(params.uri, 'SHARE_SHEET');
      const shared = await ReceiptOcr.drainSharedInbox();
      if (shared[0]) await processImage(shared[0].uri, 'SHARE_SHEET');
    })();
  }, [params.source, params.uri, processImage]);

  const capture = useCallback(async (automatic = false) => {
    if (!camera || !cameraReady || operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      const photo = await camera.takePictureAsync({ quality: 0.9, skipProcessing: false });
      if (photo?.uri) await processImage(photo.uri, 'CAMERA', automatic);
    } catch {
      if (!automatic) setError('Could not capture the proof.');
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
      if (!result.canceled && result.assets[0]) await processImage(result.assets[0].uri, 'IMAGE_IMPORT');
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
        <View style={[styles.processingIndicator, { backgroundColor: theme.colors.surface }]}>
          <ActivityIndicator color={theme.colors.primary} />
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
        <ScreenTitle title="Check details" />
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" accessibilityLabel="Captured payment proof" /> : null}
        {!fields.amountCentavos || !fields.referenceValue ? <Notice kind="warning">One detail needs attention.</Notice> : null}
        <TextInput label="Amount" mode="outlined" keyboardType="decimal-pad" value={amountText} onChangeText={setAmountText} right={<TextInput.Affix text="₱" />} />
        <TextInput
          label="Reference number"
          mode="outlined"
          value={fields.referenceValue ?? ''}
          onChangeText={(value) => setFields({
            ...fields,
            referenceValue: value || null,
            referenceNamespace: value ? (fields.referenceNamespace ?? namespaceFor(fields)) : null,
          })}
          autoCapitalize="characters"
        />
        {error ? <Notice kind="error">{error}</Notice> : null}
        {!sourceId && !sources.data?.length ? (
          <Button mode="contained" onPress={() => router.push('/settings/sources')}>Add payment source</Button>
        ) : (
          <Button mode="contained" onPress={() => void saveReview()} disabled={saveLock.current} style={{ minHeight: TOUCH_TARGET }}>Save</Button>
        )}
        <Button onPress={reset}>Retake</Button>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} tabbed style={styles.page}>
      <View style={styles.header}>
        <ScreenTitle title="Scan proof" />
        <IconButton icon="account-circle-outline" accessibilityLabel="Open settings" onPress={() => router.push('/(tabs)/settings')} />
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
  processingIndicator: { position: 'absolute', bottom: 128, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  preview: { width: '100%', height: 210, borderRadius: RADIUS.lg, backgroundColor: '#000000' },
});
