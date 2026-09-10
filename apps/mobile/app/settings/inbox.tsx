import type { CreateRecordResponse, OwnerInboxEvent } from '@paytsek/contracts';
import React, { useState } from 'react';
import { Button, Card, Text } from 'react-native-paper';
import { EmptyState, ErrorState, Loading, Notice, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { newId } from '@/lib/device';
import { APP_VERSION } from '@/lib/env';
import { manilaTime, peso } from '@/lib/format';
import { useInbox, useInvalidateRecord } from '@/lib/queries';

/** Owner-only: unmatched incoming notifications. Cashiers never see this screen. */
export default function Inbox() {
  const q = useInbox();
  const invalidate = useInvalidateRecord();
  const [msg, setMsg] = useState<string | null>(null);

  /** Intentionally save an incoming event as a record (counts as one record). */
  const saveAsRecord = async (e: OwnerInboxEvent) => {
    setMsg(null);
    const fields = {
      receiptProvider: e.provider, paymentRail: e.paymentRail, currency: 'PHP' as const, amountCentavos: e.amountCentavos, feeCentavos: null, totalChargedCentavos: null,
      referenceNamespace: e.referenceValue ? e.referenceNamespace : null, referenceValue: e.referenceValue, payerName: e.payerMaskedName, payerPhone: e.payerMaskedPhone, payeeName: null, payeePhone: null,
      receiptTransactionAt: e.eventAt, receiptTransactionPrecision: 'SECOND' as const, receiptStatus: 'SUCCESS' as const,
    };
    try {
      const id = newId();
      const r = await api<CreateRecordResponse>('/v1/records', { method: 'POST', body: { clientRecordId: id, sourceId: e.sourceId, proofId: null, captureOrigin: 'FROM_EVENT', capturedAt: new Date().toISOString(), appVersion: APP_VERSION, receiptParserId: null, receiptParserVersion: null, ocr: null, extracted: fields, corrected: fields, editedFields: [], fromEventId: e.eventId } });
      setMsg(r.quotaConsumed ? 'Saved as a record (1 record used).' : 'Already recorded.');
      invalidate();
    } catch (err) { setMsg((err as Error).message); }
  };

  return (
    <Screen>
      <Notice kind="info">Unmatched notifications captured from your payment phone. They are purged after 7 days unless linked to a record or saved. Collecting them here is free; saving one as a record uses one record.</Notice>
      {msg ? <Notice kind="info">{msg}</Notice> : null}
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} retry={() => void q.refetch()} /> : null}
      {q.data?.length === 0 ? <EmptyState icon="inbox-outline" title="No unmatched notifications" body="New incoming-payment notifications from your payment phone appear here until they are matched." /> : null}
      {q.data?.map((e) => (
        <Card key={e.eventId} mode="outlined">
          <Card.Title title={`${peso(e.amountCentavos)} from ${e.payerMaskedName ?? e.payerMaskedPhone ?? 'unknown'}`} subtitle={`${e.sourceLabel} · ${manilaTime(e.eventAt, 'SECOND')} (${e.eventTimeSource.toLowerCase().replace(/_/g, ' ')})`} />
          <Card.Content>
            <Text variant="bodySmall">Reference: {e.referenceValue ?? 'not in notification'} · rail {e.paymentRail.toLowerCase().replace(/_/g, ' ')}</Text>
            {e.purgeAfter ? <Text variant="bodySmall" style={{ opacity: 0.6 }}>Purges {manilaTime(e.purgeAfter, 'DAY')} if not linked</Text> : null}
          </Card.Content>
          <Card.Actions><Button onPress={() => void saveAsRecord(e)}>Save as record</Button></Card.Actions>
        </Card>
      ))}
    </Screen>
  );
}
