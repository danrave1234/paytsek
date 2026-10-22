import { PROVIDERS, type CorrectRecordRequest, type RecordSummary } from '@paytsek/contracts';
import { parseMoneyExact } from '@paytsek/receipt-parsers';
import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { haptics } from '@/lib/haptics';
import { SPACING, TOUCH_TARGET } from '@/theme';
import { Notice } from './ui';

type Correction = Pick<CorrectRecordRequest['corrected'], 'amountCentavos' | 'receiptProvider'>;

/** Mount for one edit session so background refreshes never overwrite typed values. */
export function RecordCorrectionDialog({ record, onSave, onDismiss, reopensEvidence = false }: {
  record: Pick<RecordSummary, 'amountCentavos' | 'receiptProvider'>;
  onSave: (correction: Correction) => Promise<void>;
  onDismiss: () => void;
  reopensEvidence?: boolean;
}) {
  const original = useRef(record).current;
  const [amountText, setAmountText] = useState(() => (original.amountCentavos / 100).toFixed(2));
  const [provider, setProvider] = useState(original.receiptProvider ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  const save = async () => {
    if (saving.current) return;
    const amount = parseMoneyExact(amountText);
    if (!amount) { setError('Enter a valid amount.'); haptics.warning(); return; }
    const correction: Correction = {};
    if (amount.centavos !== original.amountCentavos) correction.amountCentavos = amount.centavos;
    if (provider !== (original.receiptProvider ?? null)) correction.receiptProvider = provider;
    if (!Object.keys(correction).length) { onDismiss(); return; }
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSave(correction);
      haptics.success();
      onDismiss();
    } catch (saveError) {
      haptics.warning();
      setError(saveError instanceof Error ? saveError.message : 'Could not update this record. Try again.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Dialog visible dismissable={!busy} dismissableBackButton={!busy} onDismiss={onDismiss}>
        <Dialog.Title>Correct record</Dialog.Title>
        <Dialog.ScrollArea style={{ flexShrink: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text variant="bodySmall">The proof stays with this record.</Text>
            {reopensEvidence ? <Text variant="bodySmall">Changing the amount or payment app reopens evidence review. The previous confirmation stays in History.</Text> : null}
            <TextInput label="Amount" mode="outlined" keyboardType="decimal-pad" value={amountText} onChangeText={setAmountText} disabled={busy} />
            <Text variant="labelMedium">Sent from</Text>
            <View style={styles.providers}>
              {PROVIDERS.map((item) => (
                <Chip key={item.value} selected={provider === item.value} accessibilityState={{ selected: provider === item.value, disabled: busy }} onPress={() => setProvider(item.value)} disabled={busy} style={styles.choice}>{item.label}</Chip>
              ))}
              <Chip selected={provider === null} accessibilityState={{ selected: provider === null, disabled: busy }} onPress={() => setProvider(null)} disabled={busy} style={styles.choice}>Unknown wallet</Chip>
            </View>
            {error ? <Notice kind="error">{error}</Notice> : null}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={busy} contentStyle={styles.action}>Cancel</Button>
          <Button onPress={() => void save()} loading={busy} disabled={busy} contentStyle={styles.action}>Save</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: SPACING.md, gap: SPACING.sm },
  providers: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  choice: { minHeight: TOUCH_TARGET, justifyContent: 'center' },
  action: { minHeight: TOUCH_TARGET },
});
