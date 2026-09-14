-- ---------------------------------------------------------------------------
-- Performance indexes for hot query paths.
-- ---------------------------------------------------------------------------

-- Home/Analytics/Exports filter on the effective timestamp expression.
create index if not exists payment_records_org_effective_at_idx
  on payment_records (organization_id, (coalesce(receipt_transaction_at, captured_at, created_at)));

-- Keyset pagination uses (created_at, id) as the tiebreaker.
create index if not exists payment_records_org_created_id_idx
  on payment_records (organization_id, created_at desc, id desc);

-- candidate_count subquery and reconcile lookups for records without a source.
create index if not exists notification_events_org_amount_idx
  on notification_events (organization_id, amount_centavos) where purged_at is null;

-- Retention hygiene sweep over old ingest batches.
create index if not exists ingest_batches_created_idx
  on ingest_batches (created_at);
