-- Provider-neutral signed webhook evidence. Proof recording remains primary;
-- these events are supplementary and use the same conservative matcher as
-- Android notifications.
create table evidence_connectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source_id uuid not null references payment_sources(id) on delete restrict,
  label text not null check (length(label) between 1 and 60),
  adapter text not null check (adapter in ('GENERIC_HMAC_V1')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REVOKED')),
  secret_version integer not null default 1 check (secret_version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index evidence_connectors_one_active_source_adapter_idx
  on evidence_connectors(source_id, adapter) where status = 'ACTIVE';
create index evidence_connectors_org_idx on evidence_connectors(organization_id, created_at desc);
create trigger evidence_connectors_updated_at before update on evidence_connectors
  for each row execute function set_updated_at();
create trigger evidence_connectors_source_owner before insert or update on evidence_connectors
  for each row execute function check_source_owner();

alter table notification_events alter column device_id drop not null;
alter table notification_events
  add column evidence_origin text not null default 'ANDROID_NOTIFICATION'
    check (evidence_origin in ('ANDROID_NOTIFICATION','SIGNED_WEBHOOK')),
  add column connector_id uuid references evidence_connectors(id) on delete restrict,
  add column external_event_id text,
  add column external_payment_id text,
  add column event_status text not null default 'SUCCEEDED'
    check (event_status in ('SUCCEEDED','REVERSED','REFUNDED'));

alter table notification_events add constraint notification_events_origin_scope_check check (
  (evidence_origin = 'ANDROID_NOTIFICATION' and device_id is not null and connector_id is null)
  or
  (evidence_origin = 'SIGNED_WEBHOOK' and device_id is null and connector_id is not null)
);
create unique index notification_events_connector_event_idx
  on notification_events(connector_id, external_event_id)
  where connector_id is not null and external_event_id is not null;
create unique index notification_events_connector_payment_idx
  on notification_events(connector_id, external_payment_id)
  where connector_id is not null and external_payment_id is not null;

create or replace function check_evidence_connector_scope() returns trigger language plpgsql as $$
declare c_org uuid; c_source uuid;
begin
  if new.connector_id is null then return new; end if;
  select organization_id, source_id into c_org, c_source from evidence_connectors where id = new.connector_id;
  if c_org is null or c_org <> new.organization_id or c_source <> new.source_id then
    raise exception 'evidence connector scope mismatch' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger notification_events_connector_scope before insert or update on notification_events
  for each row execute function check_evidence_connector_scope();

alter table evidence_connectors enable row level security;
create policy evidence_connectors_owner_read on evidence_connectors for select using (is_owner(organization_id));
