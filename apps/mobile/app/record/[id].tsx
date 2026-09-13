import type { EvidenceState } from '@paytsek/contracts';
import { parseMoneyExact } from '@paytsek/receipt-parsers';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Icon, IconButton, List, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { ErrorState, Loading, Notice, Screen, StateChip } from '@/components/ui';
import { isApiError } from '@/lib/api';
import { lastSeenWithTime, manilaTime, peso, stateLabel } from '@/lib/format';
import { useConfirmCandidate, useConfirmManually, useCorrectRecord, useRecord, useUnlink, useVoid } from '@/lib/queries';
import { useIsOwner, useSession } from '@/lib/session';
import { RADIUS, SPACING, stateColorsFor } from '@/theme';

function DetailCell({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  const theme = useTheme();
  return <View style={[styles.detailCell, wide && styles.detailCellWide]}><Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text><Text variant="bodyMedium" numberOfLines={wide ? undefined : 2} style={{ fontWeight: '600' }}>{value}</Text></View>;
}

const STATUS_COPY: Record<EvidenceState, { title: string; detail: string; icon: string }> = {
  UNVERIFIED: { title: 'Recorded', detail: 'Saved from the proof. No wallet evidence is linked yet.', icon: 'shield-outline' },
  REVIEW_REQUIRED: { title: 'Possible match', detail: 'A nearby incoming notification may fit this proof. Review it before linking.', icon: 'alert-circle-outline' },
  MATCHED_AUTO: { title: 'Strong match', detail: 'The proof aligns with an incoming notification on the payment phone. This is supporting evidence, not a bank guarantee.', icon: 'bell-check-outline' },
  MATCHED_BY_USER: { title: 'Strong match', detail: 'A team member linked this proof to the selected incoming notification.', icon: 'account-check-outline' },
  CONFIRMED_MANUALLY: { title: 'Confirmed after wallet check', detail: 'An owner confirmed this payment directly in the wallet app.', icon: 'check-decagram-outline' },
  VOIDED: { title: 'Voided', detail: 'This record is kept in history but excluded from recorded totals.', icon: 'cancel' },
};

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const isOwner = useIsOwner();
  const { session, workspace } = useSession();
  const rec = useRecord(id);
  const confirm = useConfirmCandidate(id);
  const manual = useConfirmManually(id);
  const unlink = useUnlink(id);
  const voidRec = useVoid(id);
  const correct = useCorrectRecord(id);
  const [dialog, setDialog] = useState<'unlink' | 'void' | 'manual' | 'edit' | null>(null);
  const [reason, setReason] = useState('');
  const [amountText, setAmountText] = useState('');
  const [msg, setMsg] = useState<{ kind: 'info' | 'error' | 'warning'; text: string } | null>(null);

  if (rec.isLoading) return <Screen scroll={false}><Loading variant="detail" label="Loading payment record" /></Screen>;
  if (rec.error || !rec.data) return <Screen scroll={false}><ErrorState error={rec.error} retry={() => void rec.refetch()} /></Screen>;
  const r = rec.data;
  const open = r.evidenceState === 'UNVERIFIED' || r.evidenceState === 'REVIEW_REQUIRED';
  const cands = r.candidates;
  const canConfirm = isOwner || session?.user.id === r.createdByUserId;
  const canEdit = isOwner || session?.user.id === r.createdByUserId;
  const status = STATUS_COPY[r.evidenceState];
  const stateColor = stateColorsFor(theme.dark)[r.evidenceState];

  const onConfirm = async (eventId: string) => {
    setMsg(null);
    try { await confirm.mutateAsync(eventId); setMsg({ kind: 'info', text: 'Notification linked. The status was updated.' }); }
    catch (e) {
      if (isApiError(e, 'MATCH_CONFLICT')) setMsg({ kind: 'warning', text: 'That notification was just claimed by another record. The list has been refreshed.' });
      else if (isApiError(e, 'CONFIRMATION_REQUIRES_OWNER_APPROVAL')) setMsg({ kind: 'warning', text: (e as Error).message });
      else setMsg({ kind: 'error', text: (e as Error).message });
    }
  };
  const runDialog = async () => {
    setMsg(null);
    try {
      if (dialog === 'unlink') await unlink.mutateAsync(reason);
      if (dialog === 'void') await voidRec.mutateAsync(reason);
      if (dialog === 'manual') await manual.mutateAsync(reason || undefined);
      if (dialog === 'edit') {
        const amount = parseMoneyExact(amountText.trim());
        if (!amount) throw new Error('Enter a valid amount.');
        await correct.mutateAsync({
          corrected: { amountCentavos: amount.centavos },
          reason: 'Updated from the app',
        });
        setMsg({ kind: 'info', text: 'Record updated.' });
      }
      setDialog(null);
      setReason('');
    }
    catch (e) { setMsg({ kind: 'error', text: (e as Error).message }); }
  };

  const openEdit = () => {
    setAmountText((r.amountCentavos / 100).toFixed(2));
    setDialog('edit');
  };

  return <Screen>
    <View style={styles.topBar}><IconButton icon="arrow-left" accessibilityLabel="Back to records" onPress={() => router.back()} /><Text variant="titleMedium" style={{ fontWeight: '700' }}>Payment record</Text><View style={{ width: 48 }} /></View>

    <View style={[styles.hero, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
      <View style={styles.heroTop}><View style={[styles.walletIcon, { backgroundColor: theme.colors.primaryContainer }]}><Icon source="wallet-outline" size={23} color={theme.colors.primary} /></View><StateChip state={r.evidenceState} /></View>
      <Text variant="headlineLarge" style={styles.amount}>{peso(r.amountCentavos)}</Text>
      <Text variant="titleMedium" style={{ fontWeight: '700' }}>{r.sourceLabel}</Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{manilaTime(r.corrected.receiptTransactionAt ?? r.capturedAt, r.corrected.receiptTransactionPrecision, workspace?.timezone)}</Text>
    </View>

    {r.evidenceState !== 'UNVERIFIED' ? <View style={[styles.statusCard, { backgroundColor: stateColor.bg }]} accessibilityLiveRegion="polite"><Icon source={status.icon} size={22} color={stateColor.fg} /><View style={{ flex: 1, gap: 3 }}><Text variant="titleSmall" style={{ color: stateColor.fg }}>{status.title}</Text><Text variant="bodySmall" style={{ color: stateColor.fg }}>{status.detail}</Text></View></View> : null}
    {r.flags.length ? <Notice kind="warning">Review note: {r.flags.map((f) => f.replace(/_/g, ' ').toLowerCase()).join(', ')}.</Notice> : null}
    {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}

    {open && cands?.candidates.length ? <View style={[styles.surface, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
      <View style={styles.sectionHeader}><View style={[styles.sectionIcon, { backgroundColor: theme.colors.surfaceVariant }]}><Icon source="bell-sync-outline" size={20} color={theme.colors.primary} /></View><View style={{ flex: 1 }}><Text variant="titleMedium" style={{ fontWeight: '700' }}>Possible notification match</Text><Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{cands.candidates.length} option{cands.candidates.length === 1 ? '' : 's'} found</Text></View></View>
      {cands.collectorStale ? <Notice kind="warning">Payment phone {lastSeenWithTime(cands.collectorLastSeenAt).toLowerCase()}.</Notice> : null}
      {cands?.candidates.map((c) => <View key={c.eventId} style={[styles.candidate, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surfaceVariant }]}><View style={{ flex: 1, gap: 2 }}><Text variant="titleSmall">{peso(c.amountCentavos)}</Text><Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{manilaTime(c.eventAt, 'SECOND', workspace?.timezone)}{c.deltaSeconds !== null ? ` · ${Math.abs(c.deltaSeconds) < 60 ? `${Math.abs(c.deltaSeconds)}s` : `${Math.round(Math.abs(c.deltaSeconds) / 60)} min`} from proof` : ''}</Text></View>{c.alreadyLinkedToOtherRecord ? <Text variant="labelSmall" style={{ color: theme.colors.error }}>Already linked</Text> : null}<Button mode="contained" compact disabled={c.alreadyLinkedToOtherRecord || confirm.isPending || !canConfirm} onPress={() => void onConfirm(c.eventId)}>Use this match</Button></View>)}
    </View> : null}

    {r.matchExplanation.kind ? <View style={[styles.matchNote, { borderColor: theme.colors.outlineVariant }]}><Icon source="information-outline" size={18} color={theme.colors.onSurfaceVariant} /><Text variant="bodySmall" style={{ flex: 1, color: theme.colors.onSurfaceVariant }}>{r.matchExplanation.disclosure ?? (r.matchExplanation.supportingFields.length ? `Matched using ${r.matchExplanation.supportingFields.join(' and ')}.` : 'Confirmation evidence recorded.')}</Text>{isOwner && r.evidenceState !== 'VOIDED' ? <Button compact onPress={() => setDialog('unlink')}>Unlink</Button> : null}</View> : null}

    <View style={[styles.surface, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
      <View style={styles.sectionHeader}><View style={[styles.sectionIcon, { backgroundColor: theme.colors.surfaceVariant }]}><Icon source="text-box-outline" size={20} color={theme.colors.primary} /></View><View><Text variant="titleMedium" style={{ fontWeight: '700' }}>Receipt details</Text><Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Read from the payment proof</Text></View></View>
      <View style={styles.detailGrid}><DetailCell label="Amount" value={peso(r.amountCentavos)} /><DetailCell label="Wallet" value={r.corrected.receiptProvider ?? r.sourceLabel} /><DetailCell label="Status" value={stateLabel(r.evidenceState)} /><DetailCell label="Time" value={manilaTime(r.corrected.receiptTransactionAt ?? r.capturedAt, r.corrected.receiptTransactionPrecision, workspace?.timezone)} /></View>
    </View>

    {r.proofImageUrl ? <View style={[styles.proofCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}><View style={styles.proofHeader}><Text variant="titleMedium" style={{ fontWeight: '700' }}>Payment proof</Text><Icon source="image-outline" size={20} color={theme.colors.onSurfaceVariant} /></View><List.Image source={{ uri: r.proofImageUrl }} style={[styles.proof, { backgroundColor: theme.colors.surfaceVariant }]} /></View> : r.hasProofImage ? <Notice kind="info">The proof image is no longer available.</Notice> : null}
    <View style={[styles.surface, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}><List.Accordion title="Activity" description={`${r.history.length} recorded event${r.history.length === 1 ? '' : 's'}`} left={(props) => <List.Icon {...props} icon="history" />}><View style={styles.history}>{r.history.map((h, i) => <View key={i} style={styles.historyRow}><View style={[styles.historyDot, { backgroundColor: theme.colors.outline }]} /><View style={{ flex: 1 }}><Text variant="bodySmall" style={{ fontWeight: '600' }}>{h.action.replace(/_/g, ' ').toLowerCase()}</Text><Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{manilaTime(h.at, 'SECOND')}{h.actorDisplayName ? ` · ${h.actorDisplayName}` : ''}</Text></View></View>)}</View></List.Accordion></View>
    {r.voidReason ? <Notice kind="error">Voided: {r.voidReason}</Notice> : null}
    {r.evidenceState !== 'VOIDED' ? <View style={styles.recordActions}>
      {canEdit ? <Button icon="pencil-outline" onPress={openEdit}>Correct amount</Button> : null}
      {isOwner && open ? <Button icon="check-circle-outline" onPress={() => setDialog('manual')}>I checked the wallet</Button> : null}
      {isOwner ? <Button icon="delete-outline" textColor={theme.colors.error} onPress={() => setDialog('void')}>Delete record</Button> : null}
    </View> : null}

    <Portal><Dialog visible={dialog !== null} onDismiss={() => setDialog(null)}><Dialog.Title>{dialog === 'edit' ? 'Correct amount' : dialog === 'unlink' ? 'Unlink association' : dialog === 'void' ? 'Delete record' : 'Confirm after wallet check'}</Dialog.Title><Dialog.Content style={{ gap: 8 }}>{dialog === 'edit' ? <><Text variant="bodySmall">The proof and correction stay in Activity.</Text><TextInput label="Amount" mode="outlined" keyboardType="decimal-pad" value={amountText} onChangeText={setAmountText} /></> : <><Text variant="bodySmall">{dialog === 'manual' ? 'Use this only after checking the receiving wallet. It is recorded as an owner confirmation, not a provider verification.' : dialog === 'void' ? 'This removes the record from active totals while preserving the proof and Activity history.' : 'The previous state remains in Activity.'}</Text><TextInput label={dialog === 'manual' ? 'Note (optional)' : 'Reason'} mode="outlined" value={reason} onChangeText={setReason} /></>}</Dialog.Content><Dialog.Actions><Button onPress={() => setDialog(null)}>Cancel</Button><Button onPress={() => void runDialog()} disabled={dialog !== 'edit' && dialog !== 'manual' && reason.trim().length < 3}>{dialog === 'edit' ? 'Save' : 'Confirm'}</Button></Dialog.Actions></Dialog></Portal>
  </Screen>;
}

const styles = StyleSheet.create({
  topBar: { height: 44, marginHorizontal: -SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.xl, padding: SPACING.xl, gap: SPACING.xs },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  walletIcon: { width: 46, height: 46, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  amount: { fontWeight: '700', letterSpacing: -0.8 },
  statusCard: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.lg, alignItems: 'flex-start' },
  surface: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: SPACING.lg, gap: SPACING.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md }, sectionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  candidate: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.sm }, verificationAction: { alignItems: 'flex-start' },
  matchNote: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  recordActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, alignItems: 'center' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: SPACING.md, rowGap: SPACING.lg }, detailCell: { width: '47%', gap: SPACING.xs }, detailCellWide: { width: '100%' },
  proofCard: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' }, proofHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg }, proof: { width: '100%', height: 320, borderRadius: 0 },
  history: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.md }, historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm }, historyDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
});
