import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Icon, IconButton, List, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { ErrorState, Loading, Notice, Screen, StateChip } from '@/components/ui';
import { isApiError } from '@/lib/api';
import { lastSeen, manilaTime, peso } from '@/lib/format';
import { useCandidates, useConfirmCandidate, useConfirmManually, useEscalate, useRecord, useUnlink, useVoid } from '@/lib/queries';
import { useIsOwner, useSession } from '@/lib/session';
import { RADIUS, SPACING, TOUCH_TARGET } from '@/theme';

function DetailCell({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.detailCell, wide && styles.detailCellWide]}>
      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
      <Text variant="bodyMedium" numberOfLines={wide ? undefined : 2} style={{ fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

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

  if (rec.isLoading) return <Screen scroll={false}><Loading variant="detail" label="Loading record" /></Screen>;
  if (rec.error || !rec.data) return <Screen scroll={false}><ErrorState error={rec.error} retry={() => void rec.refetch()} /></Screen>;
  const r = rec.data;
  const canConfirm = isOwner || (workspace && r.createdByUserId);

  const onConfirm = async (eventId: string) => {
    setMsg(null);
    try {
      await confirm.mutateAsync(eventId);
      setMsg({ kind: 'info', text: 'Linked to the selected notification.' });
    } catch (e) {
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
      setDialog(null); setReason('');
    } catch (e) { setMsg({ kind: 'error', text: (e as Error).message }); }
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <IconButton icon="arrow-left" accessibilityLabel="Back to records" onPress={() => router.back()} />
        <Text variant="titleMedium" style={{ fontWeight: '700' }}>Payment record</Text>
        <View style={{ width: 48 }} />
      </View>

      <Card mode="contained" style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
        <Card.Content style={styles.summaryContent}>
          <View style={[styles.walletIcon, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon source="wallet-outline" size={24} color={theme.colors.primary} />
          </View>
          <Text variant="headlineLarge" style={styles.amount}>{peso(r.amountCentavos)}</Text>
          <Text variant="titleMedium" style={{ fontWeight: '600' }}>{r.sourceLabel}</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{manilaTime(r.createdAt)}</Text>
          <StateChip state={r.evidenceState} />
        </Card.Content>
      </Card>

      {r.flags.length ? <Notice kind="warning">Flags: {r.flags.map((f) => f.replace(/_/g, ' ').toLowerCase()).join(', ')}. A similar image or repeated reference is a warning, not proof of a duplicate.</Notice> : null}
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}

      {r.matchExplanation.kind ? (
        <Card mode="outlined" style={styles.card}>
          <Card.Title
            title={r.evidenceState === 'CONFIRMED_MANUALLY' ? 'Confirmed by owner' : 'Notification matched'}
            subtitle={r.matchExplanation.supportingFields.length ? `Matched using ${r.matchExplanation.supportingFields.join(' and ')}` : 'Confirmation evidence'}
            left={(props) => <Icon {...props} source={r.evidenceState === 'CONFIRMED_MANUALLY' ? 'account-check-outline' : 'bell-check-outline'} color={theme.colors.primary} />}
          />
          <Card.Content>
            {r.matchExplanation.disclosure ? <Notice kind="info">{r.matchExplanation.disclosure}</Notice> : null}
            <List.Accordion title="How this was checked" titleStyle={styles.accordionTitle} style={styles.accordion}>
              <View style={styles.accordionBody}>
                {r.matchExplanation.missingFields.length ? <Text variant="bodySmall">Missing from evidence: {r.matchExplanation.missingFields.join(', ')}</Text> : null}
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Rule {r.matchExplanation.matcherVersion ?? '—'} · {r.matchExplanation.reasonCodes.join(', ') || 'manual review'} · {r.matchExplanation.timeBasis.toLowerCase().replace(/_/g, ' ')}</Text>
              </View>
            </List.Accordion>
          </Card.Content>
          {isOwner && r.evidenceState !== 'VOIDED' ? <Card.Actions><Button onPress={() => setDialog('unlink')}>Unlink</Button></Card.Actions> : null}
        </Card>
      ) : null}

      {open ? (
        <Card mode="outlined" style={styles.card}>
          <Card.Title title="Possible matches" subtitle={cands.data ? `${cands.data.candidates.length} nearby notification${cands.data.candidates.length === 1 ? '' : 's'}` : 'Checking notifications…'} left={(props) => <Icon {...props} source="bell-search-outline" color={theme.colors.tertiary} />} />
          <Card.Content style={{ gap: 10 }}>
            {cands.data?.collectorStale ? <Notice kind="warning">Payment phone {lastSeen(cands.data.collectorLastSeenAt).toLowerCase()}. No matching notification yet does not mean unpaid.</Notice> : null}
            {cands.data && cands.data.candidates.length === 0 ? <Text variant="bodyMedium">No matching notification yet.</Text> : null}
            {cands.data?.candidates.map((c) => (
              <View key={c.eventId} style={[styles.candidate, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surfaceVariant }]}>
                <Text variant="titleSmall">{peso(c.amountCentavos)} from {c.payerMaskedName ?? c.payerMaskedPhone ?? 'unknown sender'}</Text>
                <Text variant="bodySmall">{manilaTime(c.eventAt, 'SECOND')} ({c.eventTimeSource.toLowerCase().replace(/_/g, ' ')}){c.deltaSeconds !== null ? ` · ${Math.abs(c.deltaSeconds) < 60 ? `${Math.abs(c.deltaSeconds)}s` : `${Math.round(Math.abs(c.deltaSeconds) / 60)} min`} ${c.deltaSeconds >= 0 ? 'after' : 'before'} receipt` : ''}</Text>
                <Text variant="bodySmall" numberOfLines={2}>Reference: {c.referenceValue ?? 'not provided'}{c.supportingFields.length ? ` · agrees on ${c.supportingFields.join(', ')}` : ''}</Text>
                {c.alreadyLinkedToOtherRecord ? <Text variant="bodySmall" style={{ color: theme.colors.error }}>Already linked to another record.</Text> : null}
                <Button mode="contained-tonal" disabled={c.alreadyLinkedToOtherRecord || confirm.isPending || !canConfirm} onPress={() => void onConfirm(c.eventId)} style={{ minHeight: TOUCH_TARGET, marginTop: 4 }}>Confirm this notification</Button>
              </View>
            ))}
          </Card.Content>
          <Card.Actions>
            {isOwner ? <Button onPress={() => setDialog('manual')}>Confirm manually (checked wallet)</Button> : <Button onPress={() => void escalate.mutateAsync(undefined)}>Ask owner to review</Button>}
          </Card.Actions>
        </Card>
      ) : null}

      <Card mode="outlined" style={styles.card}>
        <Card.Title title="Payment details" subtitle={r.editedFields.length ? 'Some details were corrected after scanning' : 'Read from the payment proof'} />
        <Card.Content style={styles.detailGrid}>
          <DetailCell label="Reference" value={r.corrected.referenceValue ?? 'Not provided'} wide />
          <DetailCell label="Wallet" value={r.corrected.receiptProvider ?? r.sourceLabel} />
          <DetailCell label="Payment rail" value={(r.corrected.paymentRail ?? 'Unknown').replace(/_/g, ' ')} />
          {r.corrected.payerName || r.corrected.payerPhone ? <DetailCell label="Sender" value={r.corrected.payerName ?? r.corrected.payerPhone!} wide /> : null}
          {r.corrected.payeeName || r.corrected.payeePhone ? <DetailCell label="Recipient" value={r.corrected.payeeName ?? r.corrected.payeePhone!} wide /> : null}
          {r.customerLabel || r.note ? <DetailCell label="Customer / note" value={[r.customerLabel, r.note].filter(Boolean).join(' · ')} wide /> : null}
          <DetailCell label="Receipt time" value={r.corrected.receiptTransactionAt ? manilaTime(r.corrected.receiptTransactionAt, r.corrected.receiptTransactionPrecision) : 'Not shown'} wide />
        </Card.Content>
      </Card>

      {r.proofImageUrl ? (
        <Card mode="outlined" style={styles.card}>
          <Card.Title title="Payment proof" subtitle={r.proofRetentionUntil ? `Available until ${manilaTime(r.proofRetentionUntil, 'DAY')}` : undefined} left={(props) => <Icon {...props} source="image-outline" color={theme.colors.primary} />} />
          <Card.Cover source={{ uri: r.proofImageUrl }} resizeMode="contain" style={[styles.proof, { backgroundColor: theme.colors.surfaceVariant }]} accessibilityLabel="Receipt image" />
        </Card>
      ) : r.hasProofImage ? <Notice kind="info">The proof image is no longer available{r.proofRetentionUntil ? `; retention ended ${manilaTime(r.proofRetentionUntil, 'DAY')}` : ''}.</Notice> : null}

      <Card mode="outlined" style={styles.card}>
        <List.Accordion title={`Activity · ${r.history.length}`} description={`Recorded by ${r.createdByDisplayName}`} left={(props) => <List.Icon {...props} icon="history" />}>
          <View style={styles.history}>
            {r.history.map((h, i) => (
              <View key={i} style={styles.historyRow}>
                <View style={[styles.historyDot, { backgroundColor: theme.colors.outline }]} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodySmall" style={{ fontWeight: '600' }}>{h.action.replace(/_/g, ' ').toLowerCase()}</Text>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{manilaTime(h.at, 'SECOND')}{h.actorDisplayName ? ` · ${h.actorDisplayName}` : ''}{h.reason ? ` · ${h.reason}` : ''}</Text>
                </View>
              </View>
            ))}
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Captured {manilaTime(r.capturedAt)} · {r.captureOrigin.toLowerCase().replace(/_/g, ' ')}</Text>
          </View>
        </List.Accordion>
      </Card>
      {r.voidReason ? <Notice kind="error">Voided: {r.voidReason}</Notice> : null}
      {isOwner && r.evidenceState !== 'VOIDED' ? <Button icon="cancel" textColor={theme.colors.error} onPress={() => setDialog('void')}>Void record</Button> : null}

      <Portal>
        <Dialog visible={dialog !== null} onDismiss={() => setDialog(null)}>
          <Dialog.Title>{dialog === 'unlink' ? 'Unlink association' : dialog === 'void' ? 'Void record' : 'Confirm manually'}</Dialog.Title>
          <Dialog.Content style={{ gap: 8 }}>
            <Text variant="bodySmall">{dialog === 'manual' ? 'Only confirm if you checked the payment directly in your wallet app. This is recorded as an owner confirmation, not a notification match.' : 'The previous state is kept in history. Voiding excludes the record from totals and does not refund the record quota.'}</Text>
            <TextInput label={dialog === 'manual' ? 'Note (optional)' : 'Reason'} mode="outlined" value={reason} onChangeText={setReason} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialog(null)}>Cancel</Button>
            <Button onPress={() => void runDialog()} disabled={dialog !== 'manual' && reason.trim().length < 3}>Confirm</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { height: 44, marginHorizontal: -SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryCard: { borderRadius: RADIUS.xl, overflow: 'hidden' },
  summaryContent: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.xs },
  walletIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  amount: { fontWeight: '700', letterSpacing: -0.8 },
  card: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  accordion: { paddingHorizontal: 0, backgroundColor: 'transparent' },
  accordionTitle: { fontSize: 14 },
  accordionBody: { gap: SPACING.xs, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  candidate: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.xs },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: SPACING.md, rowGap: SPACING.lg },
  detailCell: { width: '47%', gap: SPACING.xs },
  detailCellWide: { width: '100%' },
  proof: { height: 320, borderRadius: 0 },
  history: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.md },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  historyDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
});
