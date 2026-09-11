-- Billing, quotas, ledgers, jobs, exports.

-- ---------------------------------------------------------------------------
-- Plans & subscriptions
-- ---------------------------------------------------------------------------
create table plans (
  code plan_code primary key,
  display_name text not null,
  monthly_record_allowance integer not null,
  scanner_devices integer not null,
  collector_devices integer not null,
  receiving_sources integer not null,
  members integer not null,
  proof_image_retention_days integer not null,
  -- Store product ids; configurable, never hardcoded in app logic.
  app_store_product_id text,
  play_store_product_id text
);

insert into plans values
  ('FREE','Free',50,1,1,1,2,30,null,null),
  ('SOLO','Solo',1000,2,1,1,2,90,'paytsek_solo_monthly','paytsek_solo_monthly'),
  ('TEAM','Team',5000,5,2,2,5,90,'paytsek_team_monthly','paytsek_team_monthly');

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  -- Exactly one billing owner per subscription; restore cannot re-target another workspace.
  billing_owner_user_id uuid not null references auth.users(id) on delete restrict,
  revenuecat_app_user_id text not null,
  plan_code plan_code not null,
  status subscription_status not null default 'NONE',
  store text check (store in ('APP_STORE','PLAY_STORE')),
  store_product_id text,
  original_transaction_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_period_end timestamptz,
  cancelled_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One active subscription per workspace; one workspace per store subscription.
create unique index subscriptions_one_active_per_org_idx on subscriptions(organization_id) where status in ('ACTIVE','GRACE_PERIOD','BILLING_RETRY');
create unique index subscriptions_original_txn_idx on subscriptions(store, original_transaction_id) where original_transaction_id is not null;
create trigger subscriptions_updated_at before update on subscriptions for each row execute function set_updated_at();

-- Verified store events (RevenueCat webhooks). Idempotent by event id.
create table billing_events (
  id text primary key,
  organization_id uuid references organizations(id) on delete set null,
  revenuecat_app_user_id text,
  event_type text not null,
  store text,
  product_id text,
  transaction_id text,
  original_transaction_id text,
  event_at timestamptz not null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  received_at timestamptz not null default now()
);
create index billing_events_org_idx on billing_events(organization_id, event_at desc);

-- ---------------------------------------------------------------------------
-- Usage & credit ledgers (exactly-once)
-- ---------------------------------------------------------------------------
-- Monthly allowance usage. One row per canonical record; the unique index makes
-- retries and duplicate submissions free.
create table usage_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  record_id uuid references payment_records(id) on delete set null,
  kind text not null check (kind in ('USAGE','ADJUSTMENT')),
  -- +1 consumes a unit; -1 is an audited adjustment (e.g. confirmed duplicate).
  delta integer not null check (delta in (-1, 1)),
  -- Which pool paid for it.
  pool text not null check (pool in ('MONTHLY','PREPAID')),
  -- Server-assigned billing period (client timestamps cannot backdate usage).
  period_start date not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index usage_ledger_one_usage_per_record_idx on usage_ledger(record_id) where kind = 'USAGE';
create index usage_ledger_org_period_idx on usage_ledger(organization_id, period_start);

-- Prepaid credits. Grants keyed by verified store transaction id; never expire.
create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in ('GRANT','REVOCATION','CONSUME','ADJUSTMENT')),
  delta integer not null,
  store_transaction_id text,
  record_id uuid references payment_records(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
create unique index credit_ledger_grant_txn_idx on credit_ledger(store_transaction_id) where kind = 'GRANT';
create unique index credit_ledger_revoke_txn_idx on credit_ledger(store_transaction_id) where kind = 'REVOCATION';
create unique index credit_ledger_one_consume_per_record_idx on credit_ledger(record_id) where kind = 'CONSUME';
create index credit_ledger_org_idx on credit_ledger(organization_id);

-- Per-organization row used as a serialization point for quota allocation.
create table quota_locks (
  organization_id uuid primary key references organizations(id) on delete cascade
);

-- Billing period start for an org: subscription period if active, else calendar month (UTC).
create or replace function current_period_start(p_org uuid) returns date language sql stable as $$
  select coalesce(
    (select (s.current_period_start at time zone 'UTC')::date from subscriptions s
       where s.organization_id = p_org and s.status in ('ACTIVE','GRACE_PERIOD','BILLING_RETRY')
       and s.current_period_start is not null and s.current_period_start <= now()
       and (s.current_period_end is null or s.current_period_end > now())
       limit 1),
    date_trunc('month', now() at time zone 'UTC')::date
  );
$$;

-- Prepaid credits remaining (grants - revocations - consumes +/- adjustments).
create or replace function prepaid_credits_remaining(p_org uuid) returns integer language sql stable as $$
  select coalesce(sum(delta), 0)::integer from credit_ledger where organization_id = p_org;
$$;

create or replace function monthly_used(p_org uuid, p_period date) returns integer language sql stable as $$
  select coalesce(sum(delta), 0)::integer from usage_ledger
  where organization_id = p_org and pool = 'MONTHLY' and period_start = p_period;
$$;

-- Atomically consume one recorded-payment unit for a record.
-- Returns the pool used, or 'NONE' when the quota is exhausted (nothing written).
-- Idempotent: a record that already has a USAGE row returns 'ALREADY'.
create or replace function consume_record_quota(p_org uuid, p_record uuid, p_actor uuid)
returns text language plpgsql as $$
declare
  v_period date;
  v_allowance integer;
  v_used integer;
  v_credits integer;
begin
  -- Serialize per organization so concurrent saves never over-allocate.
  insert into quota_locks(organization_id) values (p_org) on conflict do nothing;
  perform 1 from quota_locks where organization_id = p_org for update;

  if exists (select 1 from usage_ledger where record_id = p_record and kind = 'USAGE') then
    return 'ALREADY';
  end if;

  v_period := current_period_start(p_org);
  select p.monthly_record_allowance into v_allowance
    from organizations o join plans p on p.code = o.plan_code where o.id = p_org;
  v_used := monthly_used(p_org, v_period);

  if v_used < v_allowance then
    insert into usage_ledger(organization_id, record_id, kind, delta, pool, period_start, created_by)
      values (p_org, p_record, 'USAGE', 1, 'MONTHLY', v_period, p_actor);
    return 'MONTHLY';
  end if;

  v_credits := prepaid_credits_remaining(p_org);
  if v_credits > 0 then
    insert into usage_ledger(organization_id, record_id, kind, delta, pool, period_start, created_by)
      values (p_org, p_record, 'USAGE', 1, 'PREPAID', v_period, p_actor);
    insert into credit_ledger(organization_id, kind, delta, record_id, reason)
      values (p_org, 'CONSUME', -1, p_record, 'record usage');
    return 'PREPAID';
  end if;

  return 'NONE';
end $$;

-- ---------------------------------------------------------------------------
-- Jobs (Postgres-backed outbox with leases + SKIP LOCKED)
-- ---------------------------------------------------------------------------
create table jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  -- Coalescing key: at most one PENDING job per key.
  dedupe_key text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING' check (status in ('PENDING','LEASED','DONE','FAILED','DEAD')),
  run_after timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 8,
  leased_until timestamptz,
  leased_by text,
  last_error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index jobs_pending_dedupe_idx on jobs(dedupe_key) where status = 'PENDING' and dedupe_key is not null;
create index jobs_ready_idx on jobs(run_after) where status in ('PENDING','LEASED');

-- Lease up to N ready jobs for a worker.
create or replace function lease_jobs(p_worker text, p_limit integer, p_lease_seconds integer)
returns setof jobs language plpgsql as $$
begin
  return query
  with picked as (
    select id from jobs
    where (status = 'PENDING' and run_after <= now())
       or (status = 'LEASED' and leased_until < now())
    order by run_after
    limit p_limit
    for update skip locked
  )
  update jobs j set status = 'LEASED', leased_by = p_worker,
    leased_until = now() + make_interval(secs => p_lease_seconds), attempts = attempts + 1
  from picked where j.id = picked.id
  returning j.*;
end $$;

-- ---------------------------------------------------------------------------
-- Exports (expire and delete after 24h)
-- ---------------------------------------------------------------------------
create table export_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  format text not null check (format in ('CSV','XLSX')),
  params jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING','RUNNING','READY','FAILED','EXPIRED')),
  storage_path text,
  row_count integer,
  error_code text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index export_jobs_org_idx on export_jobs(organization_id, created_at desc);
create index export_jobs_expiry_idx on export_jobs(expires_at) where status = 'READY';

-- Diagnostics export consent (opt-in, off by default). Content-free counters only.
create table diagnostics_consent (
  organization_id uuid primary key references organizations(id) on delete cascade,
  redacted_samples_enabled boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
