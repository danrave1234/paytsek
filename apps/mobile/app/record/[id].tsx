import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { Button, Card, Dialog, Divider, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { ErrorState, Loading, Notice, Row, Screen, StateChip } from '@/components/ui';
import { isApiError } from '@/lib/api';
import { lastSeen, manilaTime, peso } from '@/lib/format';
import { useCandidates, useConfirmCandidate, useConfirmManually, useEscalate, useRecord, useUnlink, useVoid } from '@/lib/queries';
import { useIsOwner, useSession } from '@/lib/session';
import { TOUCH_TARGET } from '@/theme';

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
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

  if (rec.isLoading) return <Screen scroll={false}><Loading /></Screen>;
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="headlineMedium">{peso(r.amountCentavos)}</Text>
        <StateChip state={r.evidenceState} />
      </View>
      <Text variant="bodySmall" style={{ opacity: 0.7 }}>{r.sourceLabel} · recorded {manilaTime(r.createdAt)} by {r.createdByDisplayName}</Text>
      {r.flags.length ? <Notice kind="warning">Flags: {r.flags.map((f) => f.replace(/_/g, ' ').toLowerCase()).join(', ')}. A similar image or repeated reference is a warning, not proof of a duplicate.</Notice> : null}
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}

      {r.matchExplanation.kind ? (
        <Card mode="outlined">
          <Card.Title title={r.evidenceState === 'CONFIRMED_MANUALLY' ? 'Confirmed manually by owner' : 'Matched to an incoming notification'} />
          <Card.Content style={{ gap: 4 }}>
            {r.matchExplanation.disclosure ? <Notice kind="info">{r.matchExplanation.disclosure}</Notice> : null}
            {r.matchExplanation.supportingFields.length ? <Text variant="bodySmall">Agreed on: {r.matchExplanation.supportingFields.join(', ')}</Text> : null}
            {r.matchExplanation.missingFields.length ? <Text variant="bodySmall">Missing: {r.matchExplanation.missingFields.join(', ')}</Text> : null}
            <Text variant="bodySmall" style={{ opacity: 0.6 }}>Rule {r.matchExplanation.matcherVersion ?? '—'} · {r.matchExplanation.reasonCodes.join(', ')} · time basis {r.matchExplanation.timeBasis.toLowerCase().replace(/_/g, ' ')}</Text>
          </Card.Content>
          {isOwner && r.evidenceState !== 'VOIDED' ? <Card.Actions><Button onPress={() => setDialog('unlink')}>Unlink</Button></Card.Actions> : null}
        </Card>
      ) : null}

      {open ? (
        <Card mode="outlined">
          <Card.Title title="Candidate notifications" subtitle={cands.data ? `${cands.data.candidates.length} within the ${Math.round(cands.data.windowSeconds / 60)}-minute window (${cands.data.timeBasis.toLowerCase().replace(/_/g, ' ')})` : 'Loading…'} />
          <Card.Content style={{ gap: 10 }}>
            {cands.data?.collectorStale ? <Notice kind="warning">Payment phone {lastSeen(cands.data.collectorLastSeenAt).toLowerCase()}. No matching notification yet does not mean unpaid.</Notice> : null}
            {cands.data && cands.data.candidates.length === 0 ? <Text variant="bodyMedium">No matching notification yet.</Text> : null}
            {cands.data?.candidates.map((c) => (
              <View key={c.eventId} style={{ borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: 12, padding: 12, gap: 4 }}>
                <Text variant="titleSmall">{peso(c.amountCentavos)} from {c.payerMaskedName ?? c.payerMaskedPhone ?? 'unknown sender'}</Text>
                <Text variant="bodySmall">{manilaTime(c.eventAt, 'SECOND')} ({c.eventTimeSource.toLowerCase().replace(/_/g, ' ')}){c.deltaSeconds !== null ? ` · ${Math.abs(c.deltaSeconds) < 60 ? `${Math.abs(c.deltaSeconds)}s` : `${Math.round(Math.abs(c.deltaSeconds) / 60)} min`} ${c.deltaSeconds >= 0 ? 'after' : 'before'} receipt` : ''}</Text>
                <Text variant="bodySmall">Reference: {c.referenceValue ?? 'not in notification'} · agrees on {c.supportingFields.join(', ') || 'nothing yet'}</Text>
                {c.missingFields.length ? <Text variant="bodySmall" style={{ opacity: 0.7 }}>Missing: {c.missingFields.join(', ')}</Text> : null}
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

      <Card mode="outlined">
        <Card.Title title="Receipt details" subtitle={r.editedFields.length ? `Edited by cashier: ${r.editedFields.join(', ')}` : 'As read from the receipt'} />
        <Card.Content>
          <Row label="Provider / rail" value={`${r.corrected.receiptProvider ?? '—'} / ${r.corrected.paymentRail ?? '—'}`} />
          <Row label="Reference" value={r.corrected.referenceValue ? `${r.corrected.referenceValue} (${r.corrected.referenceNamespace})` : '—'} />
          <Row label="Sender (payer)" value={r.corrected.payerName ?? r.corrected.payerPhone ?? '—'} />
          <Row label="Recipient (payee)" value={r.corrected.payeeName ?? r.corrected.payeePhone ?? '—'} />
          <Row label="Fee / total charged" value={`${r.corrected.feeCentavos !== null ? peso(r.corrected.feeCentavos) : '—'} / ${r.corrected.totalChargedCentavos !== null ? peso(r.corrected.totalChargedCentavos) : '—'}`} />
          <Row label="Receipt time" value={r.corrected.receiptTransactionAt ? `${manilaTime(r.corrected.receiptTransactionAt, r.corrected.receiptTransactionPrecision)} (${r.corrected.receiptTransactionPrecision.toLowerCase()})` : 'not on receipt'} />
          <Row label="Receipt status" value={r.corrected.receiptStatus} />
          <Row label="Customer / note" value={[r.customerLabel, r.note].filter(Boolean).join(' · ') || '—'} />
          <Row label="Captured" value={`${manilaTime(r.capturedAt)} · ${r.captureOrigin.toLowerCase().replace(/_/g, ' ')}`} />
        </Card.Content>
      </Card>

      {r.proofImageUrl ? <Image source={{ uri: r.proofImageUrl }} style={{ width: '100%', height: 360, borderRadius: 12 }} resizeMode="contain" accessibilityLabel="Receipt image" /> : r.hasProofImage ? <Notice kind="info">Image no longer available (retention period ended{r.proofRetentionUntil ? ` ${manilaTime(r.proofRetentionUntil, 'DAY')}` : ''}).</Notice> : null}
      {r.proofRetentionUntil && r.proofImageUrl ? <Text variant="bodySmall" style={{ opacity: 0.6 }}>Image kept until {manilaTime(r.proofRetentionUntil, 'DAY')}.</Text> : null}

      <Divider />
      <Text variant="titleSmall">History</Text>
      {r.history.map((h, i) => (
        <Text key={i} variant="bodySmall">{manilaTime(h.at, 'SECOND')} · {h.action.replace(/_/g, ' ').toLowerCase()}{h.actorDisplayName ? ` · ${h.actorDisplayName}` : ''}{h.reason ? ` — ${h.reason}` : ''}</Text>
      ))}
      {r.voidReason ? <Notice kind="error">Voided: {r.voidReason}</Notice> : null}
      {isOwner && r.evidenceState !== 'VOIDED' ? <Button textColor={theme.colors.error} onPress={() => setDialog('void')}>Void record</Button> : null}

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
