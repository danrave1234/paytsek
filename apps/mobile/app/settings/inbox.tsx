import type { CreateRecordResponse, OwnerInboxEvent } from '@paytsek/contracts';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Portal, Snackbar, Text, useTheme } from 'react-native-paper';
import { ProviderLogo } from '@/components/provider-logo';
import { EmptyState, ErrorState, Group, Loading, Notice, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { newId } from '@/lib/device';
import { APP_VERSION } from '@/lib/env';
import { manilaTime, peso } from '@/lib/format';
import { useInbox, useInvalidateRecord } from '@/lib/queries';
import { SPACING } from '@/theme';

export default function Inbox() {
  const theme = useTheme();
  const query = useInbox();
  const invalidate = useInvalidateRecord();
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const saveAsRecord = async (event: OwnerInboxEvent) => {
    if (savingId) return;
    setSavingId(event.eventId);
    setError(null);
    const fields = {
      receiptProvider: event.provider,
      paymentRail: event.paymentRail,
      currency: 'PHP' as const,
      amountCentavos: event.amountCentavos,
      feeCentavos: null,
      totalChargedCentavos: null,
      referenceNamespace: event.referenceValue ? event.referenceNamespace : null,
      referenceValue: event.referenceValue,
      payerName: null,
      payerPhone: null,
      payeeName: null,
      payeePhone: null,
      receiptTransactionAt: event.eventAt,
      receiptTransactionPrecision: 'SECOND' as const,
      receiptStatus: 'SUCCESS' as const,
    };
    try {
      const response = await api<CreateRecordResponse>('/v1/records', {
        method: 'POST',
        body: {
          clientRecordId: newId(),
          sourceId: event.sourceId,
          proofId: null,
          captureOrigin: 'FROM_EVENT',
          capturedAt: new Date().toISOString(),
          appVersion: APP_VERSION,
          receiptParserId: null,
          receiptParserVersion: null,
          ocr: null,
          extracted: fields,
          corrected: fields,
          editedFields: [],
          fromEventId: event.eventId,
        },
      });
      setToast(response.deduplicated ? 'Already in records' : 'Added to records');
      invalidate();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Screen>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        Unmatched incoming-payment notifications are kept for 7 days.
      </Text>
      {error ? <Notice kind="error">{error}</Notice> : null}
      {query.isLoading ? <Loading variant="list" label="Loading incoming payments" /> : null}
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      {query.data?.length === 0 ? (
        <EmptyState icon="inbox-outline" title="Nothing waiting" body="New unmatched incoming-payment notifications will appear here." />
      ) : null}
      {(query.data?.length ?? 0) > 0 ? (
        <Group title="Recent">
          {query.data?.map((event) => (
            <View key={event.eventId} style={styles.row}>
              <ProviderLogo provider={event.provider} size={40} />
              <View style={styles.copy}>
                <Text variant="titleMedium" style={styles.amount}>{peso(event.amountCentavos)}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {event.sourceLabel} · {manilaTime(event.eventAt, 'SECOND')}
                </Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {event.referenceValue ? 'Reference included' : 'No reference in notification'}
                </Text>
              </View>
              <Button compact mode="contained-tonal" loading={savingId === event.eventId} disabled={savingId !== null} onPress={() => void saveAsRecord(event)}>
                Add
              </Button>
            </View>
          ))}
        </Group>
      ) : null}
      <Portal><Snackbar visible={toast !== null} duration={3000} onDismiss={() => setToast(null)}>{toast}</Snackbar></Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  copy: { flex: 1, gap: 2 },
  amount: { fontWeight: '700', fontVariant: ['tabular-nums'] },
});
