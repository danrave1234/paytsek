import { PROVIDERS, PROVIDER_LABELS, type Provider } from '@paytsek/contracts';
import { parseMoneyExact } from '@paytsek/receipt-parsers';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { BackHandler, Image, Pressable, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, Icon, IconButton, Portal, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import { ProviderLogo } from '@/components/provider-logo';
import { Loading, Notice, Screen } from '@/components/ui';
import { correctDraft, getDraft, pruneSynced, syncDraft, type Draft } from '@/lib/drafts';
import { manilaTime, peso } from '@/lib/format';
import { useInvalidateRecord } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { SPACING } from '@/theme';

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
  const [proofExpanded, setProofExpanded] = useState(false);
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
      const result = await syncDraft(draft);
      const next = await getDraft(workspace.id, draft.clientRecordId);
      invalidate(next?.serverRecordId ?? undefined);
      if (result.status === 'SYNCED' && next?.serverRecordId) {
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

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <ProviderLogo provider={fields.receiptProvider} size={44} />
          <View style={[styles.localChip, { backgroundColor: theme.colors.surfaceVariant }]} accessibilityRole="text" accessibilityLabel="Status: Saved on this phone">
            <Icon source="cellphone-check" size={14} color={theme.colors.onSurfaceVariant} />
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '600' }}>Saved on this phone</Text>
          </View>
        </View>
        <Text variant="displaySmall" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.amount}>{peso(fields.amountCentavos)}</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {manilaTime(occurredAt, fields.receiptTransactionPrecision, workspace?.timezone)} · Sent from {fields.receiptProvider ? PROVIDER_LABELS[fields.receiptProvider] : 'Unknown wallet'}
        </Text>
      </View>

      {draft.imageUri ? (
        <Pressable
          onPress={() => setProofExpanded((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel={proofExpanded ? 'Collapse payment proof' : 'Expand payment proof'}
          style={[styles.proofBand, { borderTopColor: theme.colors.outlineVariant, borderBottomColor: theme.colors.outlineVariant }]}
        >
          <View style={styles.proofHeader}>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, letterSpacing: 0.6 }}>PAYMENT PROOF</Text>
            <Icon source={proofExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.onSurfaceVariant} />
          </View>
          <Image
            source={{ uri: draft.imageUri }}
            resizeMode={proofExpanded ? 'contain' : 'cover'}
            accessibilityLabel="Saved payment proof"
            style={[styles.proof, { height: proofExpanded ? 420 : 116, backgroundColor: theme.colors.surfaceVariant }]}
          />
        </Pressable>
      ) : null}

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
  hero: { paddingTop: SPACING.sm, gap: SPACING.xs },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  localChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  amount: { fontWeight: '800', letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  proofBand: { marginTop: SPACING.sm, paddingVertical: SPACING.sm, gap: SPACING.sm, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  proofHeader: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  proof: { width: '100%', borderRadius: 0 },
  recordActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, alignItems: 'center' },
  providerChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  sync: { gap: SPACING.xs, alignItems: 'flex-start' },
});
