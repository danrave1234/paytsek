import type { EvidenceState } from '@paytsek/contracts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Icon, IconButton, List, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { ErrorState, Loading, Notice, Screen, StateChip } from '@/components/ui';
import { isApiError } from '@/lib/api';
import { lastSeenWithTime, manilaTime, peso } from '@/lib/format';
import { useCandidates, useConfirmCandidate, useConfirmManually, useEscalate, useRecord, useUnlink, useVoid } from '@/lib/queries';
import { useIsOwner, useSession } from '@/lib/session';
import { RADIUS, SPACING, stateColorsFor } from '@/theme';

function DetailCell({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  const theme = useTheme();
  return <View style={[styles.detailCell, wide && styles.detailCellWide]}><Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text><Text variant="bodyMedium" numberOfLines={wide ? undefined : 2} style={{ fontWeight: '600' }}>{value}</Text></View>;
}

const STATUS_COPY: Record<EvidenceState, { title: string; detail: string; icon: string }> = {
  UNVERIFIED: { title: 'Waiting for payment notification', detail: 'The receipt is safely recorded. This status updates after the payment phone receives and syncs its notification.', icon: 'clock-outline' },
  REVIEW_REQUIRED: { title: 'Needs a quick review', detail: 'More than one notification may fit this payment. Choose the right one or confirm it after checking the wallet.', icon: 'alert-circle-outline' },
  MATCHED_AUTO: { title: 'Matched to payment notification', detail: 'The amount and timing matched an incoming notification on the payment phone.', icon: 'bell-check-outline' },
  MATCHED_BY_USER: { title: 'Notification selected', detail: 'A team member linked this receipt to the selected incoming notification.', icon: 'account-check-outline' },
  CONFIRMED_MANUALLY: { title: 'Confirmed after wallet check', detail: 'An owner confirmed this payment directly in the wallet app.', icon: 'check-decagram-outline' },
  VOIDED: { title: 'Voided', detail: 'This record is kept in history but excluded from recorded totals.', icon: 'cancel' },
};

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const isOwner = useIsOwner();
  const { workspace } = useSession();
  const rec = useRecord(id);
  const open = rec.data && (rec.data.evidenceState === 'UNVERIFIED' || rec.data.evidenceState === 'REVIEW_REQUIRED');
  const cands = useCandidates(open ? id : '');
  const confirm = useConfirmCandidate(id);
  const manual = useConfirmManually(id);
  const unlink = useUnlink(id);
  const voidRec = useVoid(id);
  const escalate = useEscalate(id);
  const [dialog, setDialog] = useState<'unlink' | 'void' | 'manual' | null>(null);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<{ kind: 'info' | 'error' | 'warning'; text: string } | null>(null);

  if (rec.isLoading) return <Screen scroll={false}><Loading variant="detail" label="Loading payment record" /></Screen>;
  if (rec.error || !rec.data) return <Screen scroll={false}><ErrorState error={rec.error} retry={() => void rec.refetch()} /></Screen>;
  const r = rec.data;
  const canConfirm = isOwner || (workspace && r.createdByUserId);
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
    try { if (dialog === 'unlink') await unlink.mutateAsync(reason); if (dialog === 'void') await voidRec.mutateAsync(reason); if (dialog === 'manual') await manual.mutateAsync(reason || undefined); setDialog(null); setReason(''); }
    catch (e) { setMsg({ kind: 'error', text: (e as Error).message }); }
  };

  return <Screen>
    <View style={styles.topBar}><IconButton icon="arrow-left" accessibilityLabel="Back to records" onPress={() => router.back()} /><Text variant="titleMedium" style={{ fontWeight: '700' }}>Payment record</Text><View style={{ width: 48 }} /></View>

    <View style={[styles.hero, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
      <View style={styles.heroTop}><View style={[styles.walletIcon, { backgroundColor: theme.colors.primaryContainer }]}><Icon source="wallet-outline" size={23} color={theme.colors.primary} /></View><StateChip state={r.evidenceState} /></View>
      <Text variant="headlineLarge" style={styles.amount}>{peso(r.amountCentavos)}</Text>
      <Text variant="titleMedium" style={{ fontWeight: '700' }}>{r.sourceLabel}</Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{manilaTime(r.createdAt)}</Text>
    </View>

    <View style={[styles.statusCard, { backgroundColor: stateColor.bg }]} accessibilityLiveRegion="polite"><Icon source={status.icon} size={22} color={stateColor.fg} /><View style={{ flex: 1, gap: 3 }}><Text variant="titleSmall" style={{ color: stateColor.fg }}>{status.title}</Text><Text variant="bodySmall" style={{ color: stateColor.fg }}>{status.detail}</Text></View></View>
    {r.flags.length ? <Notice kind="warning">Review note: {r.flags.map((f) => f.replace(/_/g, ' ').toLowerCase()).join(', ')}.</Notice> : null}
    {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}

    {open ? <View style={[styles.surface, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
      <View style={styles.sectionHeader}><View style={[styles.sectionIcon, { backgroundColor: theme.colors.surfaceVariant }]}><Icon source="bell-sync-outline" size={20} color={theme.colors.primary} /></View><View style={{ flex: 1 }}><Text variant="titleMedium" style={{ fontWeight: '700' }}>Payment-phone check</Text><Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{cands.isFetching ? 'Checking for a matching notification…' : cands.data ? `${cands.data.candidates.length} possible match${cands.data.candidates.length === 1 ? '' : 'es'}` : 'Checking notifications…'}</Text></View></View>
      {cands.data?.collectorStale ? <Notice kind="warning">Payment phone {lastSeenWithTime(cands.data.collectorLastSeenAt).toLowerCase()}. Keep it online with notification access enabled; this payment remains safely recorded.</Notice> : null}
      {cands.data && cands.data.candidates.length === 0 && !cands.data.collectorStale ? <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Waiting for a matching notification. This page checks again automatically while it is open.</Text> : null}
      {cands.data?.candidates.map((c) => <View key={c.eventId} style={[styles.candidate, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surfaceVariant }]}><View style={{ flex: 1, gap: 2 }}><Text variant="titleSmall">{peso(c.amountCentavos)} · {c.payerMaskedName ?? c.payerMaskedPhone ?? 'Unknown sender'}</Text><Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{manilaTime(c.eventAt, 'SECOND')}{c.deltaSeconds !== null ? ` · ${Math.abs(c.deltaSeconds) < 60 ? `${Math.abs(c.deltaSeconds)}s` : `${Math.round(Math.abs(c.deltaSeconds) / 60)} min`} from receipt` : ''}</Text></View>{c.alreadyLinkedToOtherRecord ? <Text variant="labelSmall" style={{ color: theme.colors.error }}>Already linked</Text> : null}<Button mode="contained" compact disabled={c.alreadyLinkedToOtherRecord || confirm.isPending || !canConfirm} onPress={() => void onConfirm(c.eventId)}>Use this match</Button></View>)}
      <View style={styles.verificationAction}>{isOwner ? <Button onPress={() => setDialog('manual')}>I checked the wallet</Button> : <Button onPress={() => void escalate.mutateAsync(undefined)}>Ask owner to check</Button>}</View>
    </View> : null}

    {r.matchExplanation.kind ? <View style={[styles.matchNote, { borderColor: theme.colors.outlineVariant }]}><Icon source="information-outline" size={18} color={theme.colors.onSurfaceVariant} /><Text variant="bodySmall" style={{ flex: 1, color: theme.colors.onSurfaceVariant }}>{r.matchExplanation.disclosure ?? (r.matchExplanation.supportingFields.length ? `Matched using ${r.matchExplanation.supportingFields.join(' and ')}.` : 'Confirmation evidence recorded.')}</Text>{isOwner && r.evidenceState !== 'VOIDED' ? <Button compact onPress={() => setDialog('unlink')}>Unlink</Button> : null}</View> : null}

    <View style={[styles.surface, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
      <View style={styles.sectionHeader}><View style={[styles.sectionIcon, { backgroundColor: theme.colors.surfaceVariant }]}><Icon source="text-box-outline" size={20} color={theme.colors.primary} /></View><View><Text variant="titleMedium" style={{ fontWeight: '700' }}>Receipt details</Text><Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Read from the payment proof</Text></View></View>
      <View style={styles.detailGrid}><DetailCell label="Reference" value={r.corrected.referenceValue ?? 'Not shown'} wide /><DetailCell label="Wallet" value={r.corrected.receiptProvider ?? r.sourceLabel} />{r.corrected.paymentRail && r.corrected.paymentRail !== 'UNKNOWN' ? <DetailCell label="Payment rail" value={r.corrected.paymentRail.replace(/_/g, ' ')} /> : null}{r.corrected.payerName || r.corrected.payerPhone ? <DetailCell label="Sender" value={r.corrected.payerName ?? r.corrected.payerPhone!} wide /> : null}{r.customerLabel || r.note ? <DetailCell label="Customer / note" value={[r.customerLabel, r.note].filter(Boolean).join(' · ')} wide /> : null}<DetailCell label="Receipt time" value={r.corrected.receiptTransactionAt ? manilaTime(r.corrected.receiptTransactionAt, r.corrected.receiptTransactionPrecision) : 'Not shown'} wide /></View>
    </View>

    {r.proofImageUrl ? <View style={[styles.proofCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}><View style={styles.proofHeader}><Text variant="titleMedium" style={{ fontWeight: '700' }}>Payment proof</Text><Icon source="image-outline" size={20} color={theme.colors.onSurfaceVariant} /></View><List.Image source={{ uri: r.proofImageUrl }} style={[styles.proof, { backgroundColor: theme.colors.surfaceVariant }]} /></View> : r.hasProofImage ? <Notice kind="info">The proof image is no longer available.</Notice> : null}
    <View style={[styles.surface, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}><List.Accordion title="Activity" description={`${r.history.length} recorded event${r.history.length === 1 ? '' : 's'}`} left={(props) => <List.Icon {...props} icon="history" />}><View style={styles.history}>{r.history.map((h, i) => <View key={i} style={styles.historyRow}><View style={[styles.historyDot, { backgroundColor: theme.colors.outline }]} /><View style={{ flex: 1 }}><Text variant="bodySmall" style={{ fontWeight: '600' }}>{h.action.replace(/_/g, ' ').toLowerCase()}</Text><Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{manilaTime(h.at, 'SECOND')}{h.actorDisplayName ? ` · ${h.actorDisplayName}` : ''}</Text></View></View>)}</View></List.Accordion></View>
    {r.voidReason ? <Notice kind="error">Voided: {r.voidReason}</Notice> : null}
    {isOwner && r.evidenceState !== 'VOIDED' ? <Button icon="cancel" textColor={theme.colors.error} onPress={() => setDialog('void')}>Void record</Button> : null}

    <Portal><Dialog visible={dialog !== null} onDismiss={() => setDialog(null)}><Dialog.Title>{dialog === 'unlink' ? 'Unlink association' : dialog === 'void' ? 'Void record' : 'Confirm after wallet check'}</Dialog.Title><Dialog.Content style={{ gap: 8 }}><Text variant="bodySmall">{dialog === 'manual' ? 'Use this only after checking the receiving wallet. It is recorded as an owner confirmation, not a provider verification.' : 'The previous state remains in Activity.'}</Text><TextInput label={dialog === 'manual' ? 'Note (optional)' : 'Reason'} mode="outlined" value={reason} onChangeText={setReason} /></Dialog.Content><Dialog.Actions><Button onPress={() => setDialog(null)}>Cancel</Button><Button onPress={() => void runDialog()} disabled={dialog !== 'manual' && reason.trim().length < 3}>Confirm</Button></Dialog.Actions></Dialog></Portal>
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
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: SPACING.md, rowGap: SPACING.lg }, detailCell: { width: '47%', gap: SPACING.xs }, detailCellWide: { width: '100%' },
  proofCard: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' }, proofHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg }, proof: { width: '100%', height: 320, borderRadius: 0 },
  history: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.md }, historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm }, historyDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
});
