import type { CaptureOrigin, ReceiptFields } from '@payrecord/contracts';
import { extractReceiptFields, parseMoneyExact, type ReceiptExtraction } from '@payrecord/receipt-parsers';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { Button, Chip, Divider, Menu, Text, TextInput, useTheme } from 'react-native-paper';
import { ReceiptOcr } from 'receipt-ocr';
import { Loading, Notice, Screen, SyncChip } from '@/components/ui';
import { APP_VERSION } from '@/lib/env';
import { newId } from '@/lib/device';
import { saveDraft, stageImage, syncDraft, type Draft } from '@/lib/drafts';
import { peso } from '@/lib/format';
import { useInvalidateRecord, useSources } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { TOUCH_TARGET } from '@/theme';

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
    if (!camera) return;
    const photo = await camera.takePictureAsync({ quality: 0.9, skipProcessing: false });
    if (photo?.uri) await process(photo.uri, 'CAMERA');
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled && res.assets[0]) await process(res.assets[0].uri, 'IMAGE_IMPORT');
  };

  const reset = () => { setStage('capture'); setImageUri(null); setExtraction(null); setFields(null); setAmountText(''); setCustomer(''); setNote(''); setSaved(null); setError(null); };

  const save = async () => {
    if (!workspace || !fields || !sourceId || !extraction) return;
    const money = parseMoneyExact(amountText.trim());
    if (!money) return setError('Enter the amount received exactly as printed, e.g. 1,250.00');
    setError(null);
    const clientRecordId = newId();
    const corrected = { ...fields, amountCentavos: money.centavos, currency: 'PHP' as const };
    const stagedUri = imageUri ? await stageImage(imageUri, clientRecordId, 'jpg') : null;
    try {
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
    }
  };

  if (stage === 'processing') return <Screen scroll={false}><Loading label="Reading receipt on this phone…" /></Screen>;

  if (stage === 'saved' && saved) {
    return (
      <Screen>
        <Text variant="headlineSmall">Saved</Text>
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
      <Screen>
        <Text variant="headlineSmall">Check the receipt</Text>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" accessibilityLabel="Captured receipt" /> : null}
        {low ? <Notice kind="warning">Low readability — please check every field. Missing values are left blank, never guessed.</Notice> : null}
        {extraction.warnings.map((w) => <Notice key={w} kind="info">{w}</Notice>)}
        {fields.receiptStatus === 'FAILED' || fields.receiptStatus === 'PENDING' ? <Notice kind="error">This receipt shows status {fields.receiptStatus}. It can be recorded but will not auto-match.</Notice> : null}

        <Menu visible={menu} onDismiss={() => setMenu(false)} anchor={<Button mode="outlined" onPress={() => setMenu(true)} icon="bank-outline" style={{ minHeight: TOUCH_TARGET }}>{selected ? `${selected.label} (${selected.provider})` : 'Choose receiving account'}</Button>}>
          {sources.data?.map((s) => <Menu.Item key={s.id} title={`${s.label} · ${s.maskedDisplay}`} onPress={() => { setSourceId(s.id); setMenu(false); }} />)}
        </Menu>

        <TextInput label="Amount received (PHP)" mode="outlined" keyboardType="decimal-pad" value={amountText} onChangeText={setAmountText} right={<TextInput.Affix text="₱" />} />
        {fields.feeCentavos !== null || fields.totalChargedCentavos !== null ? (
          <Text variant="bodySmall" style={{ opacity: 0.7 }}>
            Receipt shows fee {fields.feeCentavos !== null ? peso(fields.feeCentavos) : '—'} · total charged {fields.totalChargedCentavos !== null ? peso(fields.totalChargedCentavos) : '—'} (kept separate from the amount received).
          </Text>
        ) : null}
        <TextInput label="Reference number" mode="outlined" value={fields.referenceValue ?? ''} onChangeText={(v) => setFields({ ...fields, referenceValue: v || null, referenceNamespace: v ? (fields.referenceNamespace ?? (fields.receiptProvider === 'GOTYME' ? 'GOTYME_REF_NO' : 'GCASH_REF_NO')) : null })} autoCapitalize="characters" />
        <TextInput label="Sender (payer) name — as printed" mode="outlined" value={fields.payerName ?? ''} onChangeText={(v) => setFields({ ...fields, payerName: v || null })} />
        <TextInput label="Recipient (you) — as printed" mode="outlined" value={fields.payeeName ?? ''} onChangeText={(v) => setFields({ ...fields, payeeName: v || null })} />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip icon="bank">{fields.receiptProvider ?? 'Provider unknown'}</Chip>
          <Chip icon="swap-horizontal">{fields.paymentRail ?? 'Rail unknown'}</Chip>
          <Chip icon="clock-outline">{fields.receiptTransactionAt ? `Time: ${fields.receiptTransactionPrecision.toLowerCase()} precision` : 'No time on receipt'}</Chip>
        </View>
        <Divider />
        <TextInput label="Customer (optional)" mode="outlined" value={customer} onChangeText={setCustomer} />
        <TextInput label="Order / note (optional)" mode="outlined" value={note} onChangeText={setNote} />
        {error ? <Notice kind="error">{error}</Notice> : null}
        <Button mode="contained" onPress={() => void save()} disabled={!sourceId} style={{ minHeight: TOUCH_TARGET }}>Save record</Button>
        <Button onPress={reset}>Retake</Button>
      </Screen>
    );
  }

  // capture
  return (
    <Screen scroll={false} style={{ flex: 1 }}>
      <Text variant="headlineSmall">Scan a receipt</Text>
      {!workspace ? null : sources.data?.length === 0 ? <Notice kind="warning">No receiving account yet. The owner must add one in Settings before scans can be saved.</Notice> : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      {perm?.granted ? (
        <CameraView ref={setCamera} style={styles.camera} facing="back" />
      ) : (
        <View style={[styles.camera, { backgroundColor: theme.colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
          <Text variant="bodyMedium" style={{ textAlign: 'center' }}>Camera permission is needed to capture receipts. You can also import a screenshot.</Text>
          <Button mode="contained-tonal" onPress={() => void requestPerm()} style={{ marginTop: 12 }}>Allow camera</Button>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button mode="contained" icon="camera" onPress={() => void capture()} disabled={!perm?.granted} style={{ flex: 2, minHeight: 56 }} contentStyle={{ height: 56 }}>Capture</Button>
        <Button mode="outlined" icon="image" onPress={() => void pick()} style={{ flex: 1, minHeight: 56 }} contentStyle={{ height: 56 }}>Import</Button>
      </View>
      <Text variant="bodySmall" style={{ opacity: 0.7 }}>
        {Platform.OS === 'ios' ? 'Tip: share a screenshot to PayRecord from Photos or GCash.' : 'Tip: share a screenshot to PayRecord from any app.'} Text is read on this phone only.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1, minHeight: 320, borderRadius: 16, overflow: 'hidden' },
  preview: { width: '100%', height: 260, borderRadius: 12, backgroundColor: '#00000010' },
});
