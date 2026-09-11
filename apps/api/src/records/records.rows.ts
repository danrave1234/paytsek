import type { RecordDetail, RecordSummary, ReceiptFields } from '@paytsek/contracts';

export interface RecordRow {
  id: string;
  organization_id: string;
  source_id: string;
  source_label: string;
  proof_id: string | null;
  capture_origin: RecordDetail['captureOrigin'];
  created_by: string;
  created_by_name: string | null;
  currency: 'PHP';
  amount_centavos: string;
  fee_centavos: string | null;
  total_charged_centavos: string | null;
  receipt_provider: ReceiptFields['receiptProvider'];
  payment_rail: ReceiptFields['paymentRail'];
  reference_namespace: ReceiptFields['referenceNamespace'];
  reference_value: string | null;
  payer_name: string | null;
  payer_phone: string | null;
  payee_name: string | null;
  payee_phone: string | null;
  receipt_transaction_at: Date | null;
  receipt_transaction_precision: ReceiptFields['receiptTransactionPrecision'];
  receipt_status: ReceiptFields['receiptStatus'];
  customer_label: string | null;
  note: string | null;
  edited_fields: string[];
  evidence_state: RecordSummary['evidenceState'];
  flags: RecordSummary['flags'];
  void_reason: string | null;
  captured_at: Date;
  created_at: Date;
  matcher_version: string | null;
  linked_event_id: string | null;
  candidate_count: number;
  has_proof: boolean;
}

export const RECORD_SELECT = `
  select r.*, s.label as source_label, p.display_name as created_by_name,
         (select pm.event_id from payment_matches pm where pm.record_id = r.id and pm.active) as linked_event_id,
         (case when r.evidence_state in ('UNVERIFIED','REVIEW_REQUIRED') then
            (select count(*)::int from notification_events e where e.source_id = r.source_id and e.amount_centavos = r.amount_centavos and e.purged_at is null
               and not exists (select 1 from payment_matches x where x.event_id = e.id and x.active))
          else 0 end) as candidate_count,
         (r.proof_id is not null) as has_proof
    from payment_records r
    join payment_sources s on s.id = r.source_id
    left join profiles p on p.user_id = r.created_by`;

export function rowFields(r: RecordRow): ReceiptFields {
  return {
    receiptProvider: r.receipt_provider,
    paymentRail: r.payment_rail,
    currency: 'PHP',
    amountCentavos: Number(r.amount_centavos),
    feeCentavos: r.fee_centavos === null ? null : Number(r.fee_centavos),
    totalChargedCentavos: r.total_charged_centavos === null ? null : Number(r.total_charged_centavos),
    referenceNamespace: r.reference_namespace,
    referenceValue: r.reference_value,
    payerName: r.payer_name,
    payerPhone: r.payer_phone,
    payeeName: r.payee_name,
    payeePhone: r.payee_phone,
    receiptTransactionAt: r.receipt_transaction_at?.toISOString() ?? null,
    receiptTransactionPrecision: r.receipt_transaction_precision,
    receiptStatus: r.receipt_status,
  };
}

export function toSummary(r: RecordRow): RecordSummary {
  return {
    id: r.id,
    organizationId: r.organization_id,
    sourceId: r.source_id,
    sourceLabel: r.source_label,
    evidenceState: r.evidence_state,
    flags: r.flags ?? [],
    syncStatus: 'SYNCED',
    currency: 'PHP',
    amountCentavos: Number(r.amount_centavos),
    referenceNamespace: r.reference_namespace,
    referenceValue: r.reference_value,
    payerName: r.payer_name,
    customerLabel: r.customer_label,
    note: r.note,
    capturedAt: r.captured_at.toISOString(),
    createdAt: r.created_at.toISOString(),
    createdByUserId: r.created_by,
    createdByDisplayName: r.created_by_name ?? 'Member',
    receiptTransactionAt: r.receipt_transaction_at?.toISOString() ?? null,
    hasProofImage: r.has_proof,
    linkedEventId: r.linked_event_id,
    candidateCount: r.candidate_count ?? 0,
  };
}

export function toDetail(
  r: RecordRow,
  extra: {
    extracted: ReceiptFields | null;
    history: RecordDetail['history'];
    image: { url: string; expiresAt: string; retentionUntil: string } | null;
    match: RecordDetail['matchExplanation'];
  },
): RecordDetail {
  const corrected = rowFields(r);
  return {
    ...toSummary(r),
    captureOrigin: r.capture_origin,
    extracted: extra.extracted ?? corrected,
    corrected,
    editedFields: r.edited_fields ?? [],
    matchExplanation: extra.match,
    proofImageUrl: extra.image?.url ?? null,
    proofImageExpiresAt: extra.image?.expiresAt ?? null,
    proofRetentionUntil: extra.image?.retentionUntil ?? null,
    voidReason: r.void_reason,
    history: extra.history,
  };
}
