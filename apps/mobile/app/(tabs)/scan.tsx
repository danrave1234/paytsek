import type { CaptureOrigin, ReceiptFields } from '@paytsek/contracts';
import { extractReceiptFields, parseMoneyExact, type ReceiptExtraction } from '@paytsek/receipt-parsers';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CaptureSurface } from '@/components/capture-surface';
import { AppState, Image, Platform, StyleSheet, View } from 'react-native';
import { Button, Chip, Divider, Menu, Text, TextInput, useTheme } from 'react-native-paper';
import { ReceiptOcr } from 'receipt-ocr';
import { Loading, Notice, Screen, ScreenTitle, SyncChip } from '@/components/ui';
import { APP_VERSION } from '@/lib/env';
import { newId } from '@/lib/device';
import { saveDraft, stageImage, syncDraft, type Draft } from '@/lib/drafts';
import { peso } from '@/lib/format';
import { useInvalidateRecord, useSources } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { RADIUS, SPACING, TOUCH_TARGET } from '@/theme';

type Stage = 'capture' | 'processing' | 'review' | 'saved';

export default function Scan() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string; uri?: string }>();
  const { workspace } = useSession();
  const sources = useSources();
  const invalidate = useInvalidateRecord();
  const [perm, requestPerm] = useCameraPermissions();
  const [camera, setCamera] = useState<CameraView | null>(null);

  const [stage, setStage] = useState<Stage>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [origin, setOrigin] = useState<CaptureOrigin>('CAMERA');
  const [extraction, setExtraction] = useState<ReceiptExtraction | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [fields, setFields] = useState<ReceiptFields | null>(null);
  const [amountText, setAmountText] = useState('');
  const [customer, setCustomer] = useState('');
  const [note, setNote] = useState('');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      if (state !== 'active') { setTorch(false); setCameraReady(false); }
    });
    return () => subscription.remove();
  }, []);
  const [torch, setTorch] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const operation = useRef(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => { setFocused(false); setTorch(false); setCameraReady(false); };
  }, []));

  useEffect(() => {
    if (!sourceId && sources.data?.length) setSourceId(sources.data.find((s) => s.isDefault)?.id ?? sources.data[0]!.id);
  }, [sources.data, sourceId]);

  // Share-sheet arrivals (iOS App Group inbox / Android SEND intent URI).
  useEffect(() => {
    if (params.source === 'share') {
      void (async () => {
        if (params.uri) return process(params.uri, 'SHARE_SHEET');
        const shared = await ReceiptOcr.drainSharedInbox();
        if (shared[0]) await process(shared[0].uri, 'SHARE_SHEET');
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.source, params.uri]);

  const process = useCallback(async (uri: string, from: CaptureOrigin) => {
    setStage('processing'); setError(null); setOrigin(from);
    try {
      const clean = await ReceiptOcr.stripMetadata(uri, 0.92);
      setImageUri(clean.uri);
      const ocr = await ReceiptOcr.recognize(clean.uri);
      setOcrText(ocr.fullText);
      const ex = extractReceiptFields(ocr.fullText);
      setExtraction(ex);
      setFields(ex.fields);
      setAmountText(ex.fields.amountCentavos ? (ex.fields.amountCentavos / 100).toFixed(2) : '');
      setStage('review');
    } catch (e) {
      setError(`Could not read this image: ${(e as Error).message}`);
      setStage('capture');
    }
  }, []);

  const capture = async () => {
    if (!camera || !cameraReady || operation.current) return;
    operation.current = true; setBusy(true);
    try {
      const photo = await camera.takePictureAsync({ quality: 0.9, skipProcessing: false });
      if (photo?.uri) await process(photo.uri, 'CAMERA');
    } catch (e) { setError(`Could not capture receipt: ${(e as Error).message}`); }
    finally { operation.current = false; setBusy(false); }
  };

  const pick = async () => {
    if (operation.current) return;
    operation.current = true; setBusy(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (!res.canceled && res.assets[0]) await process(res.assets[0].uri, 'IMAGE_IMPORT');
    } catch (e) { setError(`Could not import image: ${(e as Error).message}`); }
    finally { operation.current = false; setBusy(false); }
  };

  const reset = () => { setStage('capture'); setImageUri(null); setExtraction(null); setFields(null); setAmountText(''); setCustomer(''); setNote(''); setSaved(null); setError(null); };

  const save = async () => {
    if (!workspace || !fields || !sourceId || !extraction || saveLock.current) return;
    const money = parseMoneyExact(amountText.trim());
    if (!money) return setError('Enter the amount received exactly as printed, e.g. 1,250.00');
    saveLock.current = true; setSaving(true);
    setError(null);
    const clientRecordId = newId();
    const corrected = { ...fields, amountCentavos: money.centavos, currency: 'PHP' as const };
    try {
      const stagedUri = imageUri ? await stageImage(imageUri, clientRecordId, 'jpg') : null;
      const draft = await saveDraft({
        clientRecordId,
        workspaceId: workspace.id,
        imageUri: stagedUri,
        contentType: 'image/jpeg',
        request: {
          clientRecordId,
          sourceId,
          proofId: null,
          captureOrigin: origin,
          capturedAt: new Date().toISOString(),
          appVersion: APP_VERSION,
          receiptParserId: extraction.parserId,
          receiptParserVersion: extraction.parserVersion,
          ocr: { engine: 'MLKIT_TEXT_V2', engineVersion: 'mlkit', fullText: ocrText.slice(0, 20000), blocks: [], readabilityScore: extraction.readabilityScore },
          extracted: extraction.fields,
          corrected,
          editedFields: [],
          customerLabel: customer || null,
          note: note || null,
        },
      });
      setSaved(draft);
      setStage('saved');
      const status = await syncDraft(draft);
      setSaved({ ...draft, syncStatus: status, quotaBlocked: status === 'LOCAL_DRAFT' && draft.quotaBlocked });
      invalidate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      saveLock.current = false; setSaving(false);
    }
  };

  if (stage === 'processing') return <Screen scroll={false} tabbed><Loading variant="progress" label="Reading receipt on this phone…" /></Screen>;

  if (stage === 'saved' && saved) {
    return (
      <Screen tabbed>
        <ScreenTitle title="Saved" subtitle="Your payment record is ready" />
        <SyncChip status={saved.syncStatus} quotaBlocked={saved.quotaBlocked} />
        <Notice kind="info">
          Record saved as Unverified. Saving is not payment verification — matching happens on the server when a notification from your payment phone agrees.
        </Notice>
        {saved.quotaBlocked ? <Notice kind="warning">Monthly record allowance reached. This scan is kept as a local draft and will sync after the owner tops up or the month resets.</Notice> : null}
        {saved.lastError && !saved.quotaBlocked ? <Notice kind="warning">{saved.lastError}</Notice> : null}
        <Button mode="contained" onPress={reset} style={{ minHeight: TOUCH_TARGET }}>Scan another</Button>
        <Button onPress={() => router.push('/(tabs)/records')}>Go to records</Button>
      </Screen>
    );
  }

  if (stage === 'review' && fields && extraction) {
    const selected = sources.data?.find((s) => s.id === sourceId);
    const low = extraction.readabilityScore < 0.6;
    return (
      <Screen tabbed>
        <ScreenTitle title="Check the receipt" subtitle="Confirm the details before saving" />
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" accessibilityLabel="Captured receipt" /> : null}
        {low ? <Notice kind="warning">Low readability — please check every field. Missing values are left blank, never guessed.</Notice> : null}
        {extraction.warnings.map((w) => <Notice key={w} kind="info">{w}</Notice>)}
        {fields.receiptStatus === 'FAILED' || fields.receiptStatus === 'PENDING' ? <Notice kind="error">This receipt shows status {fields.receiptStatus}. It can be recorded but will not auto-match.</Notice> : null}

        {(sources.data?.length ?? 0) > 1 ? (
          <Menu visible={menu} onDismiss={() => setMenu(false)} anchor={<Button mode="outlined" onPress={() => setMenu(true)} icon="cellphone-message" style={{ minHeight: TOUCH_TARGET }}>{selected ? `${selected.provider} on main phone` : 'Choose payment source'}</Button>}>
            {sources.data?.map((s) => <Menu.Item key={s.id} leadingIcon={s.id === sourceId ? 'check-circle' : 'cellphone-message'} titleStyle={s.id === sourceId ? { color: theme.colors.primary, fontWeight: '700' } : undefined} title={`${s.provider} notifications on main phone`} onPress={() => { setSourceId(s.id); setMenu(false); }} />)}
          </Menu>
        ) : selected ? <Notice kind="info">Using {selected.provider} notifications from the main payment phone.</Notice> : null}

        <TextInput label="Amount received (PHP)" mode="outlined" keyboardType="decimal-pad" value={amountText} onChangeText={setAmountText} right={<TextInput.Affix text="₱" />} />
        {fields.feeCentavos !== null || fields.totalChargedCentavos !== null ? (
          <Text variant="bodySmall" style={{ opacity: 0.7 }}>
            Receipt shows fee {fields.feeCentavos !== null ? peso(fields.feeCentavos) : '—'} · total charged {fields.totalChargedCentavos !== null ? peso(fields.totalChargedCentavos) : '—'} (kept separate from the amount received).
          </Text>
        ) : null}
        <TextInput label="Reference number" mode="outlined" value={fields.referenceValue ?? ''} onChangeText={(v) => setFields({ ...fields, referenceValue: v || null, referenceNamespace: v ? (fields.referenceNamespace ?? (fields.receiptProvider === 'GOTYME' ? 'GOTYME_REF_NO' : fields.receiptProvider === 'MAYA' ? 'MAYA_REF_NO' : 'GCASH_REF_NO')) : null })} autoCapitalize="characters" />
        <TextInput label="Sender (payer) name — as printed" mode="outlined" value={fields.payerName ?? ''} onChangeText={(v) => setFields({ ...fields, payerName: v || null })} />
        <TextInput label="Recipient (you) — as printed" mode="outlined" value={fields.payeeName ?? ''} onChangeText={(v) => setFields({ ...fields, payeeName: v || null })} />
        <View style={{ flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' }}>
          <Chip icon="bank">{fields.receiptProvider ?? 'Provider unknown'}</Chip>
          <Chip icon="swap-horizontal">{fields.paymentRail ?? 'Rail unknown'}</Chip>
          <Chip icon="clock-outline">{fields.receiptTransactionAt ? `Time: ${fields.receiptTransactionPrecision.toLowerCase()} precision` : 'No time on receipt'}</Chip>
        </View>
        <Divider />
        <TextInput label="Customer (optional)" mode="outlined" value={customer} onChangeText={setCustomer} />
        <TextInput label="Order / note (optional)" mode="outlined" value={note} onChangeText={setNote} />
        {error ? <Notice kind="error">{error}</Notice> : null}
        <Button mode="contained" onPress={() => void save()} loading={saving} disabled={!sourceId || saving} style={{ minHeight: TOUCH_TARGET }}>Save record</Button>
        <Button onPress={reset}>Retake</Button>
      </Screen>
    );
  }

  // capture
  return (
    <Screen scroll={false} tabbed style={{ flex: 1 }}>
      <ScreenTitle title="Scan" subtitle="Capture a payment proof" />
      {!workspace ? null : sources.data?.length === 0 ? <Button compact icon="cellphone-message" mode="outlined" onPress={() => router.push('/settings/sources')}>Add payment source</Button> : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      <CaptureSurface granted={!!perm?.granted} canAskAgain={perm?.canAskAgain !== false} active={focused && foreground} ready={cameraReady} busy={busy}
        cameraRef={setCamera} onReady={() => setCameraReady(true)} torch={torch} onTorch={() => setTorch((value) => !value)}
        onPermission={() => void requestPerm()} onCapture={() => void capture()} onImport={() => void pick()} />
      <Text variant="bodySmall" style={{ opacity: 0.7 }}>Import a screenshot any time. Text is read on this phone only.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1, minHeight: 320, borderRadius: RADIUS.lg, overflow: 'hidden' },
  preview: { width: '100%', height: 260, borderRadius: RADIUS.md, backgroundColor: '#00000010' },
});
