import { PROVIDERS, PROVIDER_LABELS, type EvidenceState, type Provider } from '@paytsek/contracts';
import { parseMoneyExact } from '@paytsek/receipt-parsers';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { BackHandler, Image, Pressable, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, Icon, IconButton, Portal, Snackbar, Text, TextInput, TouchableRipple, useTheme } from 'react-native-paper';
import { ProviderLogo } from '@/components/provider-logo';
import { AppearMotion, FadeIn, ScreenEnter, ValueChangeMotion } from '@/components/motion';
import { ErrorState, Loading, Notice, Screen, StateChip } from '@/components/ui';
import { isApiError } from '@/lib/api';
import { lastSeenWithTime, manilaTime, peso } from '@/lib/format';
import { useConfirmCandidate, useConfirmManually, useCorrectRecord, useRecord, useUnlink, useVoid } from '@/lib/queries';
import { useIsOwner, useSession } from '@/lib/session';
import { SPACING, TOUCH_TARGET } from '@/theme';

const STATUS_COPY: Record<EvidenceState, { detail: string }> = {
  UNVERIFIED: { detail: 'Saved from the proof. No wallet evidence is linked yet.' },
  REVIEW_REQUIRED: { detail: 'A nearby incoming notification may fit this proof. Review it before linking.' },
  MATCHED_AUTO: { detail: 'The proof aligns with an incoming notification on the payment phone. This is supporting evidence, not a bank guarantee.' },
  MATCHED_BY_USER: { detail: 'A team member linked this proof to the selected incoming notification.' },
  CONFIRMED_MANUALLY: { detail: 'An owner confirmed this payment directly in the wallet app.' },
  VOIDED: { detail: 'This record is kept in history but excluded from recorded totals.' },
};

function deltaLabel(deltaSeconds: number | null): string | null {
  if (deltaSeconds === null) return null;
  const abs = Math.abs(deltaSeconds);
  return `${abs < 60 ? `${abs}s` : `${Math.round(abs / 60)} min`} from proof`;
}

/** Underlined section heading; typography and a hairline instead of a card. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.sectionTitle, { borderBottomColor: theme.colors.outlineVariant }]}>
      <Text variant="titleMedium" style={{ fontWeight: '800', letterSpacing: -0.2 }}>{children}</Text>
    </View>
  );
}

/** 48dp text action row; grouped with hairline dividers instead of a card grid. */
function ActionRow({ icon, label, onPress, divider = false, destructive = false }: {
  icon: string;
  label: string;
  onPress: () => void;
  divider?: boolean;
  destructive?: boolean;
}) {
  const theme = useTheme();
  const fg = destructive ? theme.colors.error : theme.colors.primary;
  return (
    <TouchableRipple onPress={onPress} accessibilityRole="button">
      <View style={[styles.actionRow, divider && { borderTopColor: theme.colors.outlineVariant, borderTopWidth: StyleSheet.hairlineWidth }]}>
        <Icon source={icon} size={20} color={fg} />
        <Text variant="labelLarge" style={{ color: fg }}>{label}</Text>
      </View>
    </TouchableRipple>
  );
}

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
  const [providerValue, setProviderValue] = useState<Provider | null>(null);
  const [msg, setMsg] = useState<{ kind: 'info' | 'error' | 'warning'; text: string } | null>(null);
  const [proofExpanded, setProofExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Every poll response carries a freshly signed proof URL; pin the first one so
  // the already-loaded image never re-downloads (and flashes) while the screen is open.
  const pinnedProofUrl = useRef<string | null>(null);
  if (rec.data?.proofImageUrl && !pinnedProofUrl.current) pinnedProofUrl.current = rec.data.proofImageUrl;
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/records');
  }, [router]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack]));

  if (rec.isLoading) return <Screen scroll={false}><Loading variant="detail" label="Loading payment record" /></Screen>;
  if (rec.error || !rec.data) return <Screen scroll={false}><ErrorState error={rec.error} retry={() => void rec.refetch()} /></Screen>;
  const r = rec.data;
  const open = r.evidenceState === 'UNVERIFIED' || r.evidenceState === 'REVIEW_REQUIRED';
  const cands = r.candidates;
  const canConfirm = isOwner || session?.user.id === r.createdByUserId;
  const canEdit = isOwner || session?.user.id === r.createdByUserId;

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
      // The unlink contract requires a reason of at least 3 characters, so an
      // empty optional input falls back to a stable audit note.
      if (dialog === 'unlink') await unlink.mutateAsync(reason.trim() || 'Unlinked from the app');
      if (dialog === 'void') await voidRec.mutateAsync(reason);
      if (dialog === 'manual') await manual.mutateAsync(reason || undefined);
      if (dialog === 'edit') {
        const amount = parseMoneyExact(amountText.trim());
        if (!amount) throw new Error('Enter a valid amount.');
        await correct.mutateAsync({
          corrected: { amountCentavos: amount.centavos, receiptProvider: providerValue },
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
    setProviderValue(r.corrected.receiptProvider);
    setDialog('edit');
  };

  const receiptWallet = r.corrected.receiptProvider ? PROVIDER_LABELS[r.corrected.receiptProvider] : 'Unknown wallet';
  const receivingWallet = r.receivingProvider
    ? PROVIDER_LABELS[r.receivingProvider]
    : r.receivingSourceLabel ?? null;
  const occurredAt = manilaTime(r.corrected.receiptTransactionAt ?? r.capturedAt, r.corrected.receiptTransactionPrecision, workspace?.timezone);

  return <Screen>
    <ScreenEnter>
      <View style={styles.topBar}><IconButton icon="arrow-left" accessibilityLabel="Back to records" onPress={goBack} /><Text variant="titleMedium" style={{ fontWeight: '700' }}>Payment record</Text><View style={{ width: 48 }} /></View>

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <ProviderLogo provider={r.corrected.receiptProvider} label={r.sourceLabel} size={44} />
          <StateChip state={r.evidenceState} compact />
        </View>
        <ValueChangeMotion value={r.amountCentavos}>
          <Text variant="displaySmall" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.amount}>{peso(r.amountCentavos)}</Text>
        </ValueChangeMotion>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {occurredAt} · Sent from {receiptWallet}{receivingWallet ? ` · Received in ${receivingWallet}` : ''}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{STATUS_COPY[r.evidenceState].detail}</Text>
      </View>

      {r.flags.length ? <Notice kind="warning">Review note: {r.flags.map((f) => f.replace(/_/g, ' ').toLowerCase()).join(', ')}.</Notice> : null}
      {r.voidReason ? <Notice kind="error">Voided: {r.voidReason}</Notice> : null}
      {msg && msg.kind !== 'info' ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}

      {pinnedProofUrl.current ? (
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
            source={{ uri: pinnedProofUrl.current }}
            resizeMode={proofExpanded ? 'contain' : 'cover'}
            accessibilityLabel="Saved payment proof"
            style={[styles.proof, { height: proofExpanded ? 420 : 116, backgroundColor: theme.colors.surfaceVariant }]}
          />
        </Pressable>
      ) : r.hasProofImage ? <Notice kind="info">The proof image is no longer available.</Notice> : null}

      <SectionTitle>Evidence</SectionTitle>
      {open && cands?.candidates.length ? (
        <View>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {cands.candidates.length} nearby notification{cands.candidates.length === 1 ? '' : 's'} on the payment phone. Linking one is notification evidence, not a provider confirmation.
          </Text>
          {cands.collectorStale ? <Notice kind="warning">Payment phone {lastSeenWithTime(cands.collectorLastSeenAt).toLowerCase()}.</Notice> : null}
          {cands.candidates.map((c, index) => {
            const payer = c.payerMaskedName ?? c.payerMaskedPhone;
            const meta = [PROVIDER_LABELS[c.provider], deltaLabel(c.deltaSeconds), payer].filter(Boolean).join(' · ');
            return (
              <AppearMotion key={c.eventId} itemKey={`candidate.${c.eventId}`}>
                <View style={[styles.candidateRow, index > 0 && { borderTopColor: theme.colors.outlineVariant, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="titleSmall" style={{ fontVariant: ['tabular-nums'] }}>{peso(c.amountCentavos)}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{meta}</Text>
                    <Text variant="labelSmall" style={{ color: c.alreadyLinkedToOtherRecord ? theme.colors.error : theme.colors.onSurfaceVariant }}>
                      {c.alreadyLinkedToOtherRecord ? 'Already linked to another record' : manilaTime(c.eventAt, 'SECOND', workspace?.timezone)}
                    </Text>
                  </View>
                  <Button mode="text" compact style={styles.candidateAction} disabled={c.alreadyLinkedToOtherRecord || confirm.isPending || !canConfirm} onPress={() => void onConfirm(c.eventId)}>Use match</Button>
                </View>
              </AppearMotion>
            );
          })}
        </View>
      ) : null}
      {r.matchExplanation.kind ? (
        <View style={styles.matchNote}>
          <Icon source="information-outline" size={18} color={theme.colors.onSurfaceVariant} />
          <Text variant="bodySmall" style={{ flex: 1, color: theme.colors.onSurfaceVariant }}>{r.matchExplanation.disclosure ?? (r.matchExplanation.supportingFields.length ? `Matched using ${r.matchExplanation.supportingFields.join(' and ')}.` : 'Confirmation evidence recorded.')}</Text>
        </View>
      ) : null}
      {!r.matchExplanation.kind && !(open && cands?.candidates.length) ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>No wallet notification evidence is linked to this record.</Text>
      ) : null}

      <SectionTitle>History</SectionTitle>
      <TouchableRipple onPress={() => setHistoryOpen((current) => !current)} accessibilityRole="button" accessibilityState={{ expanded: historyOpen }}>
        <View style={styles.historyToggle}>
          <Icon source="history" size={20} color={theme.colors.onSurfaceVariant} />
          <Text variant="bodyMedium" style={{ flex: 1 }}>{r.history.length} recorded event{r.history.length === 1 ? '' : 's'}</Text>
          <Icon source={historyOpen ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.onSurfaceVariant} />
        </View>
      </TouchableRipple>
      {historyOpen ? (
        <FadeIn>
          <View style={[styles.timeline, { borderLeftColor: theme.colors.outlineVariant }]}>
            {r.history.map((h, i) => (
              <View key={i} style={{ gap: 2 }}>
                <Text variant="bodySmall" style={{ fontWeight: '600' }}>{h.action.replace(/_/g, ' ').toLowerCase()}</Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{manilaTime(h.at, 'SECOND', workspace?.timezone)}{h.actorDisplayName ? ` · ${h.actorDisplayName}` : ''}</Text>
              </View>
            ))}
          </View>
        </FadeIn>
      ) : null}

      {r.evidenceState !== 'VOIDED' ? (
        <View style={[styles.actions, { borderTopColor: theme.colors.outlineVariant }]}>
          {canEdit ? <ActionRow icon="pencil-outline" label="Correct record" onPress={openEdit} /> : null}
          {isOwner && open ? <ActionRow icon="check-circle-outline" label="I checked the wallet" onPress={() => setDialog('manual')} divider={canEdit} /> : null}
          {isOwner && r.matchExplanation.kind ? <ActionRow icon="link-off" label="Unlink evidence" onPress={() => setDialog('unlink')} divider /> : null}
          {isOwner ? <ActionRow icon="delete-outline" label="Void record" onPress={() => setDialog('void')} divider destructive /> : null}
        </View>
      ) : null}
    </ScreenEnter>

    <Portal>
      <Dialog visible={dialog !== null} onDismiss={() => setDialog(null)}><Dialog.Title>{dialog === 'edit' ? 'Correct record' : dialog === 'unlink' ? 'Unlink association' : dialog === 'void' ? 'Void record' : 'Confirm after wallet check'}</Dialog.Title><Dialog.Content style={{ gap: 8 }}>{dialog === 'edit' ? <><Text variant="bodySmall">The proof and correction stay in History.</Text><TextInput label="Amount" mode="outlined" keyboardType="decimal-pad" value={amountText} onChangeText={setAmountText} /><Text variant="labelMedium">Sent from</Text><View style={styles.providerChoices}>{PROVIDERS.map((item) => <Chip key={item.value} selected={providerValue === item.value} onPress={() => setProviderValue(item.value)}>{item.label}</Chip>)}</View></> : <><Text variant="bodySmall">{dialog === 'manual' ? 'Use this only after checking the receiving wallet. It is recorded as an owner confirmation, not a provider verification.' : dialog === 'void' ? 'This removes the record from active totals while preserving the proof and History.' : 'The previous state remains in History.'}</Text><TextInput label={dialog === 'void' ? 'Reason' : dialog === 'manual' ? 'Note (optional)' : 'Reason (optional)'} mode="outlined" value={reason} onChangeText={setReason} /></>}</Dialog.Content><Dialog.Actions><Button onPress={() => setDialog(null)}>Cancel</Button><Button onPress={() => void runDialog()} disabled={dialog === 'void' && reason.trim().length < 3}>{dialog === 'edit' ? 'Save' : 'Confirm'}</Button></Dialog.Actions></Dialog>
      <Snackbar visible={msg?.kind === 'info'} duration={3000} onDismiss={() => setMsg(null)}>{msg?.text}</Snackbar>
    </Portal>
  </Screen>;
}

const styles = StyleSheet.create({
  topBar: { height: 44, marginHorizontal: -SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: { paddingTop: SPACING.sm, gap: SPACING.xs },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  amount: { fontWeight: '800', letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  proofBand: { marginTop: SPACING.sm, paddingVertical: SPACING.sm, gap: SPACING.sm, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  proofHeader: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  proof: { width: '100%', borderRadius: 0 },
  sectionTitle: { minHeight: 40, marginTop: SPACING.sm, justifyContent: 'flex-end', paddingBottom: SPACING.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  candidateRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  candidateAction: { minHeight: TOUCH_TARGET, justifyContent: 'center' },
  matchNote: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs },
  historyToggle: { minHeight: TOUCH_TARGET, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  timeline: { marginLeft: SPACING.sm + 2, paddingLeft: SPACING.lg, gap: SPACING.md, borderLeftWidth: 1 },
  actions: { marginTop: SPACING.md, borderTopWidth: StyleSheet.hairlineWidth },
  actionRow: { minHeight: TOUCH_TARGET, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  providerChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
});
