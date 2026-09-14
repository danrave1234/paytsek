import { PROVIDERS, PROVIDER_LABELS, type Provider } from '@paytsek/contracts';
import { parseMoneyExact } from '@paytsek/receipt-parsers';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { BackHandler, Image, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, IconButton, Portal, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import { Loading, Notice, Screen } from '@/components/ui';
import { correctDraft, getDraft, pruneSynced, syncDraft, type Draft } from '@/lib/drafts';
import { manilaTime, peso } from '@/lib/format';
import { useInvalidateRecord } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { RADIUS, SPACING } from '@/theme';

export default function LocalRecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { workspace } = useSession();
  const invalidate = useInvalidateRecord();
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined);
  const [amountText, setAmountText] = useState('');
  const [providerValue, setProviderValue] = useState<Provider | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/records');
  }, [router]);

  const load = useCallback(async () => {
    if (!workspace || !id) return setDraft(null);
    const next = await getDraft(workspace.id, id);
    if (next?.syncStatus === 'SYNCED' && next.serverRecordId) {
      // The server owns this record; background pruning may delete the staged
      // copy at any moment, so hand over to the canonical detail screen.
      router.replace(`/record/${next.serverRecordId}`);
      return;
    }
    setDraft(next);
    if (next) {
      setAmountText((next.request.corrected.amountCentavos / 100).toFixed(2));
      setProviderValue(next.request.corrected.receiptProvider);
    }
  }, [id, router, workspace]);

  useFocusEffect(useCallback(() => {
    void load();
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack, load]));

  const save = async () => {
    if (!draft || !workspace || busy) return;
    const amount = parseMoneyExact(amountText.trim());
    if (!amount) return setError('Enter a valid amount.');
    setBusy(true);
    setError(null);
    try {
      const next = await correctDraft(workspace.id, draft.clientRecordId, {
        amountCentavos: amount.centavos,
        receiptProvider: providerValue,
      });
      setDraft(next);
      invalidate();
      setEditing(false);
      setToast('Record updated');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update this record.');
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    if (!draft || !workspace || busy) return;
    setBusy(true);
    setError(null);
    try {
      const status = await syncDraft(draft);
      const next = await getDraft(workspace.id, draft.clientRecordId);
      invalidate(next?.serverRecordId ?? undefined);
      if (status === 'SYNCED' && next?.serverRecordId) {
        // The server owns the record now; remove the redundant staged copy.
        await pruneSynced(workspace.id);
        router.replace(`/record/${next.serverRecordId}`);
        return;
      }
      setDraft(next);
      setError(next?.lastError || 'The record is still waiting to sync.');
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Could not sync this record.');
    } finally {
      setBusy(false);
    }
  };

  if (draft === undefined) return <Screen scroll={false}><Loading variant="detail" label="Opening local record" /></Screen>;
  if (!draft) return <Screen scroll={false}><Notice kind="warning">This local record has already synced or is no longer on this phone.</Notice><Button onPress={goBack}>Back to records</Button></Screen>;

  const fields = draft.request.corrected;
  const occurredAt = fields.receiptTransactionAt ?? draft.request.capturedAt ?? draft.createdAt;
  const waiting = draft.syncStatus !== 'SYNCED';

  return (
    <Screen>
      <View style={styles.topBar}>
        <IconButton icon="arrow-left" accessibilityLabel="Back to records" onPress={goBack} />
        <Text variant="titleMedium" style={styles.topTitle}>Payment record</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={[styles.hero, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>SAVED ON THIS PHONE</Text>
        <Text variant="headlineLarge" style={styles.amount}>{peso(fields.amountCentavos)}</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {fields.receiptProvider ? PROVIDER_LABELS[fields.receiptProvider] : 'Unknown wallet'} · {manilaTime(occurredAt, fields.receiptTransactionPrecision, workspace?.timezone)}
        </Text>
      </View>

      {draft.imageUri ? <Image source={{ uri: draft.imageUri }} style={[styles.proof, { backgroundColor: theme.colors.surfaceVariant }]} resizeMode="contain" accessibilityLabel="Saved payment proof" /> : null}

      <View style={styles.recordActions}>
        <Button icon="pencil-outline" onPress={() => { setError(null); setEditing(true); }} disabled={busy || draft.syncStatus === 'UPLOADING'}>Correct record</Button>
      </View>

      {error ? <Notice kind="error">{error}</Notice> : null}
      {waiting ? (
        <View style={styles.sync}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {draft.syncStatus === 'UPLOADING' ? 'Syncing now.' : 'Not uploaded yet. The proof remains safely stored on this phone.'}
          </Text>
          {draft.syncStatus !== 'UPLOADING' ? <Button icon="cloud-upload-outline" onPress={() => void retry()} disabled={busy}>Retry sync</Button> : null}
        </View>
      ) : null}

      <Portal>
        <Dialog visible={editing} onDismiss={busy ? undefined : () => setEditing(false)}>
          <Dialog.Title>Correct record</Dialog.Title>
          <Dialog.Content style={{ gap: SPACING.sm }}>
            <Text variant="bodySmall">The proof stays with this record.</Text>
            <TextInput label="Amount" mode="outlined" keyboardType="decimal-pad" value={amountText} onChangeText={setAmountText} disabled={busy} />
            <Text variant="labelMedium">Sent from</Text>
            <View style={styles.providerChoices}>{PROVIDERS.map((item) => <Chip key={item.value} selected={providerValue === item.value} onPress={() => setProviderValue(item.value)} disabled={busy}>{item.label}</Chip>)}</View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditing(false)} disabled={busy}>Cancel</Button>
            <Button onPress={() => void save()} loading={busy} disabled={busy}>Save</Button>
          </Dialog.Actions>
        </Dialog>
        <Snackbar visible={toast !== null} duration={2600} onDismiss={() => setToast(null)}>{toast}</Snackbar>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { height: 44, marginHorizontal: -SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontWeight: '700' },
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.xl, padding: SPACING.xl, gap: SPACING.xs },
  amount: { fontWeight: '700', letterSpacing: -0.8 },
  proof: { width: '100%', height: 300, borderRadius: RADIUS.lg },
  recordActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, alignItems: 'center' },
  providerChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  sync: { gap: SPACING.xs, alignItems: 'flex-start' },
});
