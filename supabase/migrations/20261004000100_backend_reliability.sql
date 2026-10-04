-- Durable privacy requests; the hash continues to reject old JWT subjects after
-- Auth deletion. Never expose this operational table through the client API.
create table account_deletions (
  id uuid primary key default gen_random_uuid(),
  subject_hash text not null unique,
  user_id uuid,
  status text not null default 'PENDING' check (status in ('PENDING','RETRYING','COMPLETE','FAILED')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error_code text,
  attempts integer not null default 0
);
alter table account_deletions enable row level security;
revoke all on account_deletions from anon, authenticated;

-- A signed-in owner's personal collector is tied to that identity; a separately
-- paired workspace payment phone deliberately has no personal-owner field.
alter table devices add column current_phone_user_id uuid references auth.users(id) on delete set null;
update devices d set current_phone_user_id=(
  select a.actor_user_id from audit_events a where a.subject_type='device' and a.subject_id=d.id
    and a.action='DEVICE_APPROVED' order by a.created_at desc,a.id desc limit 1
) where exists (
  select 1 from (select a.after_ref from audit_events a where a.subject_type='device' and a.subject_id=d.id
    and a.action='DEVICE_APPROVED' order by a.created_at desc,a.id desc limit 1) latest
  where latest.after_ref->>'setup'='current-phone'
);

-- Business records belong to workspaces, not the departing Auth identity.
-- Preserve every ledger/audit row and allow the deleted author's FK to be null.
do $$
declare item record;
begin
  for item in
    select c.conrelid::regclass as rel, c.conname, a.attname
      from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
     where c.contype='f' and c.confrelid='auth.users'::regclass
       and c.confdeltype='r' and c.connamespace='public'::regnamespace
  loop
    execute format('alter table %s alter column %I drop not null', item.rel, item.attname);
    execute format('alter table %s drop constraint %I', item.rel, item.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references auth.users(id) on delete set null', item.rel, item.conname, item.attname);
  end loop;
end $$;

-- Serialize new writes by an identity with its deletion request. Existing
-- author fields are retained until Auth removes the identity and sets them null.
create function reject_deleted_actor() returns trigger
language plpgsql security definer set search_path=public,extensions as $$
declare actor uuid;
begin
  actor := (to_jsonb(new)->>tg_argv[0])::uuid;
  if actor is not null then
    perform pg_advisory_xact_lock(hashtextextended(actor::text, 901));
    if exists (select 1 from account_deletions where subject_hash=encode(digest(actor::text,'sha256'),'hex')) then
      raise exception 'account is being deleted' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
do $$
declare item record;
begin
  for item in select * from (values
    ('profiles','user_id'), ('memberships','user_id'), ('organizations','created_by'),
    ('payment_records','created_by'), ('payment_proofs','uploaded_by'),
    ('invitations','invited_by'), ('pairing_sessions','created_by'),
    ('evidence_connectors','created_by'), ('export_jobs','requested_by'), ('devices','current_phone_user_id')
  ) as actors(rel, col)
  loop
    execute format('create trigger account_active_before_insert before insert on %I for each row execute function reject_deleted_actor(%L)',item.rel,item.col);
  end loop;
end $$;
revoke all on function reject_deleted_actor() from public;

-- Direct Supabase reads must enforce the same cashier scope as Nest.
create or replace function is_member(p_org uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists (select 1 from memberships m join organizations o on o.id=m.organization_id
    where m.organization_id=p_org and m.user_id=auth.uid() and o.deleted_at is null);
$$;
create or replace function is_owner(p_org uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists (select 1 from memberships m join organizations o on o.id=m.organization_id
    where m.organization_id=p_org and m.user_id=auth.uid() and m.role='OWNER' and o.deleted_at is null);
$$;
drop policy payment_records_member_read on payment_records;
create policy payment_records_member_read on payment_records for select to authenticated
  using (is_member(organization_id) and (is_owner(organization_id) or created_by=auth.uid()));
drop policy payment_matches_member_read on payment_matches;
create policy payment_matches_member_read on payment_matches for select to authenticated
  using (is_member(organization_id) and (is_owner(organization_id) or exists (
    select 1 from payment_records r where r.id=record_id and r.created_by=auth.uid())));
-- A column-level REVOKE cannot override the existing table-level SELECT grant.
revoke select on devices from anon, authenticated;
grant select (id,organization_id,install_id,label,platform,capability,status,app_version,os_version,device_model,
  credential_rotated_at,revoked_at,revoked_reason,last_server_contact_at,last_observed_event_at,
  pending_upload_count,listener_connected,notification_access_granted,diagnostic_reason,provider_apps,created_at)
  on devices to authenticated;
revoke select on payment_sources from anon, authenticated;
grant select (id,organization_id,provider,label,masked_display,is_default,collection_paused,
  require_owner_approval_for_staff_matches,created_at,deleted_at) on payment_sources to authenticated;

-- Revision tokens prevent successful inline work from erasing later triggers.
alter table jobs add column revision integer not null default 1;
create table maintenance_reports (
  name text primary key,
  checked_at timestamptz not null default now(),
  details jsonb not null default '{}'
);
alter table maintenance_reports enable row level security;
revoke all on maintenance_reports from anon, authenticated;
grant all on account_deletions, maintenance_reports to service_role;
create index payment_records_retention_created_idx on payment_records(created_at);

-- Existing XLSX requests were always written as CSV; make the stored format truthful.
update export_jobs set format='CSV' where format='XLSX';

-- Optional scheduler is intentionally not activated by migration. Provision
-- pg_cron, pg_net and Vault via the documented operator setup, then call this
-- service-role-only function after the two named Vault secrets exist.
create function configure_paytsek_job_schedule() returns void
language plpgsql security definer set search_path=public,extensions as $$
begin
  if to_regclass('vault.secrets') is null or to_regclass('cron.job') is null then
    raise exception 'Vault and pg_cron must be enabled before scheduler setup';
  end if;
  if not exists (select 1 from pg_extension where extname='pg_net') then
    raise exception 'pg_net must be enabled before scheduler setup';
  end if;
  if (select count(*) from vault.secrets where name in ('paytsek_api_url','paytsek_cron_secret')) <> 2 then
    raise exception 'Configure paytsek_api_url and paytsek_cron_secret in Vault first';
  end if;
  perform cron.schedule('paytsek-job-drain','* * * * *', $job$
    select net.http_get(
      url := (select decrypted_secret from vault.decrypted_secrets where name='paytsek_api_url') || '/v1/internal/cron/drain',
      headers := jsonb_build_object('Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='paytsek_cron_secret')),
      timeout_milliseconds := 15000
    );
  $job$);
end $$;
revoke all on function configure_paytsek_job_schedule() from public, anon, authenticated;
grant execute on function configure_paytsek_job_schedule() to service_role;
