-- PayTsek core schema.
-- Conventions: UUID PKs, every tenant row carries organization_id, amounts are
-- integer centavos, references are TEXT, timestamps are timestamptz (UTC) with
-- source precision retained where relevant.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enumerations (mirrored in @paytsek/contracts)
-- ---------------------------------------------------------------------------
create type evidence_state as enum ('UNVERIFIED','REVIEW_REQUIRED','MATCHED_AUTO','MATCHED_BY_USER','CONFIRMED_MANUALLY','VOIDED');
create type membership_role as enum ('OWNER','CASHIER');
create type device_capability as enum ('SCANNER','COLLECTOR','BOTH');
create type device_platform as enum ('ANDROID','IOS');
create type device_status as enum ('ACTIVE','PAUSED','REVOKED');
create type provider as enum ('GCASH','GOTYME');
create type payment_rail as enum ('EXPRESS_SEND','QR_P2P','QR_MERCHANT','INSTAPAY','PESONET','BANK_TRANSFER','UNKNOWN');
create type reference_namespace as enum ('GCASH_REF_NO','GCASH_EXPRESS_SEND_REF','GOTYME_REF_NO','INSTAPAY_TRACE_NO','PESONET_TRACE_NO','UNKNOWN');
create type capture_origin as enum ('CAMERA','IMAGE_IMPORT','SHARE_SHEET','FROM_EVENT');
create type receipt_status as enum ('SUCCESS','PENDING','FAILED','UNKNOWN');
create type time_precision as enum ('SECOND','MINUTE','HOUR','DAY','UNKNOWN');
create type time_basis as enum ('RECEIPT_TRANSACTION_TIME','CAPTURE_TIME','NONE');
create type match_kind as enum ('AUTO','USER_SELECTED','MANUAL_OWNER_CONFIRMATION');
create type pairing_state as enum ('PENDING','ACCEPTED','APPROVED','EXPIRED','REJECTED','CONSUMED');
create type plan_code as enum ('FREE','SOLO','TEAM');
create type subscription_status as enum ('NONE','ACTIVE','GRACE_PERIOD','BILLING_RETRY','CANCELLED','EXPIRED','REFUNDED');

-- ---------------------------------------------------------------------------
-- Workspace / membership
-- ---------------------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  timezone text not null default 'Asia/Manila',
  plan_code plan_code not null default 'FREE',
  is_demo boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role membership_role not null,
  can_confirm_matches boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index memberships_user_idx on memberships(user_id);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role membership_role not null,
  can_confirm_matches boolean not null default false,
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index invitations_org_idx on invitations(organization_id);

-- ---------------------------------------------------------------------------
-- Receiving sources
-- ---------------------------------------------------------------------------
create table payment_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider provider not null,
  label text not null check (length(label) between 1 and 60),
  -- Owner-declared; NOT provider-verified.
  declared_identifier text not null,
  masked_display text not null,
  recipient_aliases text[] not null default '{}',
  is_default boolean not null default false,
  collection_paused boolean not null default false,
  require_owner_approval_for_staff_matches boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index payment_sources_org_idx on payment_sources(organization_id);
create unique index payment_sources_one_default_idx on payment_sources(organization_id) where is_default and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Devices, pairing, bindings
-- ---------------------------------------------------------------------------
create table devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  -- App-generated install id; never a hardware identifier.
  install_id uuid not null,
  label text not null,
  platform device_platform not null,
  capability device_capability not null,
  status device_status not null default 'ACTIVE',
  app_version text,
  os_version text,
  device_model text,
  -- Collector credential: only the HMAC hash is stored.
  credential_hash text unique,
  credential_rotated_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  last_server_contact_at timestamptz,
  last_observed_event_at timestamptz,
  pending_upload_count integer,
  listener_connected boolean,
  notification_access_granted boolean,
  diagnostic_reason text,
  provider_apps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, install_id)
);
create index devices_org_idx on devices(organization_id);

create table device_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  device_id uuid not null references devices(id) on delete cascade,
  source_id uuid not null references payment_sources(id) on delete cascade,
  status device_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
-- One active collector per receiving account/provider binding.
create unique index device_bindings_one_active_per_source_idx on device_bindings(source_id) where status = 'ACTIVE';
create index device_bindings_device_idx on device_bindings(device_id);

create table pairing_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source_id uuid not null references payment_sources(id) on delete cascade,
  requested_capability device_capability not null,
  device_label text,
  code_hash text not null unique,
  state pairing_state not null default 'PENDING',
  created_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_device_id uuid references devices(id) on delete set null,
  accepted_payload jsonb,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  consumed_at timestamptz,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index pairing_sessions_org_idx on pairing_sessions(organization_id, state);

-- Pairing attempt rate limiting (by IP hash and by install id).
create table pairing_attempts (
  id bigserial primary key,
  bucket text not null,
  attempted_at timestamptz not null default now()
);
create index pairing_attempts_bucket_idx on pairing_attempts(bucket, attempted_at);

-- ---------------------------------------------------------------------------
-- Proofs (evidence images + extracted fields)
-- ---------------------------------------------------------------------------
create table payment_proofs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_proof_id uuid not null,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  storage_path text,
  content_type text not null,
  byte_length integer not null check (byte_length > 0),
  sha256 text not null check (length(sha256) = 64),
  perceptual_hash text,
  upload_finalized_at timestamptz,
  -- Retention entitlement fixed at creation; downgrades never shorten it.
  retention_days integer not null,
  retention_until timestamptz not null,
  purged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, client_proof_id),
  -- Exact-bytes duplicates map to the same proof within a workspace.
  unique (organization_id, sha256)
);
create index payment_proofs_retention_idx on payment_proofs(retention_until) where purged_at is null;

-- ---------------------------------------------------------------------------
-- Payment records (one canonical recorded payment)
-- ---------------------------------------------------------------------------
create table payment_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source_id uuid not null references payment_sources(id) on delete restrict,
  client_record_id uuid not null,
  proof_id uuid references payment_proofs(id) on delete set null,
  capture_origin capture_origin not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_by_device_id uuid references devices(id) on delete set null,
  app_version text,
  receipt_parser_id text,
  receipt_parser_version text,
  -- Money & identity (from the *corrected* fields; extracted originals live in proof_versions)
  currency text not null default 'PHP' check (currency = 'PHP'),
  amount_centavos bigint not null check (amount_centavos > 0),
  fee_centavos bigint check (fee_centavos >= 0),
  total_charged_centavos bigint check (total_charged_centavos > 0),
  receipt_provider provider,
  payment_rail payment_rail,
  reference_namespace reference_namespace,
  reference_value text,
  payer_name text,
  payer_phone text,
  payee_name text,
  payee_phone text,
  receipt_transaction_at timestamptz,
  receipt_transaction_precision time_precision not null default 'UNKNOWN',
  receipt_status receipt_status not null default 'UNKNOWN',
  customer_label text,
  note text,
  edited_fields text[] not null default '{}',
  -- Evidence state is separate from sync state (sync state lives on the client).
  evidence_state evidence_state not null default 'UNVERIFIED',
  flags text[] not null default '{}',
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Reconciliation bookkeeping
  matcher_version text,
  last_reconciled_at timestamptz,
  unique (organization_id, client_record_id)
);
create index payment_records_org_created_idx on payment_records(organization_id, created_at desc);
create index payment_records_org_state_idx on payment_records(organization_id, evidence_state);
create index payment_records_source_amount_idx on payment_records(source_id, amount_centavos);
create index payment_records_reference_idx on payment_records(organization_id, reference_namespace, reference_value) where reference_value is not null;
-- Duplicate detection by scoped normalized reference: flagged, not blocked (owner may correct OCR).
create index payment_records_proof_idx on payment_records(proof_id);

create table proof_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  record_id uuid not null references payment_records(id) on delete cascade,
  version integer not null,
  kind text not null check (kind in ('OCR_ORIGINAL','USER_CORRECTION','OWNER_CORRECTION')),
  ocr jsonb,
  fields jsonb not null,
  edited_fields text[] not null default '{}',
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (record_id, version)
);

-- ---------------------------------------------------------------------------
-- Incoming notification events (owner-restricted visibility)
-- ---------------------------------------------------------------------------
create table notification_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source_id uuid not null references payment_sources(id) on delete restrict,
  device_id uuid not null references devices(id) on delete restrict,
  client_event_id uuid not null,
  provider provider not null,
  source_package text not null,
  source_app_version_name text,
  source_app_version_code integer,
  parser_id text not null,
  parser_version text not null,
  payment_rail payment_rail not null,
  currency text not null default 'PHP' check (currency = 'PHP'),
  amount_centavos bigint not null check (amount_centavos > 0),
  reference_namespace reference_namespace not null,
  reference_value text,
  payer_masked_name text,
  payer_masked_phone text,
  provider_described_at timestamptz,
  notification_when_at timestamptz,
  posted_at timestamptz not null,
  captured_at timestamptz not null,
  monotonic_capture_ms bigint not null,
  boot_session_id text not null,
  server_received_at timestamptz not null default now(),
  lifecycle_dedup_key text not null,
  normalized_text_sha256 text not null,
  was_group_child boolean not null default false,
  -- Retention: purge if never linked/saved after N days.
  purge_after timestamptz,
  purged_at timestamptz,
  -- Set when an owner intentionally saves this event as a record.
  saved_as_record_id uuid references payment_records(id) on delete set null,
  unique (device_id, client_event_id),
  -- Reposting / updating the same notification must not create a new event.
  unique (source_id, lifecycle_dedup_key)
);
create index notification_events_candidate_idx on notification_events(source_id, amount_centavos, posted_at);
create index notification_events_reference_idx on notification_events(source_id, reference_namespace, reference_value) where reference_value is not null;
create index notification_events_purge_idx on notification_events(purge_after) where purged_at is null;

-- Ingestion batch idempotency: replays return the stored acks.
create table ingest_batches (
  id uuid primary key,
  device_id uuid not null references devices(id) on delete cascade,
  acks jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Matches (one active association per record and per event)
-- ---------------------------------------------------------------------------
create table payment_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  record_id uuid not null references payment_records(id) on delete cascade,
  -- Null for MANUAL_OWNER_CONFIRMATION (no notification involved).
  event_id uuid references notification_events(id) on delete restrict,
  kind match_kind not null,
  reason_codes text[] not null default '{}',
  supporting_fields text[] not null default '{}',
  missing_fields text[] not null default '{}',
  time_basis time_basis not null default 'NONE',
  window_seconds integer,
  delta_seconds integer,
  flow_id text,
  matcher_version text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unlinked_at timestamptz,
  unlinked_by uuid references auth.users(id) on delete set null,
  unlink_reason text,
  check (kind <> 'MANUAL_OWNER_CONFIRMATION' or event_id is null),
  check (kind = 'MANUAL_OWNER_CONFIRMATION' or event_id is not null)
);
-- Enforced by the database, not by application filtering.
create unique index payment_matches_one_active_per_event_idx on payment_matches(event_id) where active and event_id is not null;
create unique index payment_matches_one_active_per_record_idx on payment_matches(record_id) where active;
create index payment_matches_record_idx on payment_matches(record_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
create table audit_events (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_device_id uuid references devices(id) on delete set null,
  action text not null,
  subject_type text not null,
  subject_id uuid,
  before_ref jsonb,
  after_ref jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_events_org_idx on audit_events(organization_id, created_at desc);
create index audit_events_subject_idx on audit_events(subject_type, subject_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger payment_records_updated_at before update on payment_records for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenant integrity: a match must join a record and an event of the same
-- organization and the same receiving source.
-- ---------------------------------------------------------------------------
create or replace function check_match_scope() returns trigger language plpgsql as $$
declare
  r_org uuid; r_source uuid; e_org uuid; e_source uuid;
begin
  select organization_id, source_id into r_org, r_source from payment_records where id = new.record_id;
  if r_org is null or r_org <> new.organization_id then
    raise exception 'match organization does not match record organization' using errcode = '23514';
  end if;
  if new.event_id is not null then
    select organization_id, source_id into e_org, e_source from notification_events where id = new.event_id;
    if e_org <> new.organization_id then
      raise exception 'event organization does not match' using errcode = '23514';
    end if;
    if e_source <> r_source then
      raise exception 'event source does not match record source' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger payment_matches_scope before insert or update on payment_matches for each row execute function check_match_scope();

-- Sources must belong to the same organization as the record/event/binding.
create or replace function check_source_owner() returns trigger language plpgsql as $$
declare s_org uuid;
begin
  select organization_id into s_org from payment_sources where id = new.source_id;
  if s_org is null or s_org <> new.organization_id then
    raise exception 'source does not belong to organization' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger payment_records_source_owner before insert or update on payment_records for each row execute function check_source_owner();
create trigger notification_events_source_owner before insert or update on notification_events for each row execute function check_source_owner();
create trigger device_bindings_source_owner before insert or update on device_bindings for each row execute function check_source_owner();
create trigger pairing_sessions_source_owner before insert or update on pairing_sessions for each row execute function check_source_owner();
