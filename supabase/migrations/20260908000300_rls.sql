-- Row-level security.
-- The NestJS API uses the service role (bypasses RLS) and enforces authorization
-- in code + via the constraints/triggers above. Mobile clients hold only the anon
-- key + a user JWT and may READ a narrow set of tables directly (mainly so
-- Supabase Realtime can deliver scoped change notifications). All WRITES go
-- through the API. Deny-by-default: every table has RLS enabled; tables without
-- a policy are unreadable by clients.

-- Helper: is the current user a member of the org?
create or replace function is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.organization_id = p_org and m.user_id = auth.uid());
$$;

create or replace function is_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.organization_id = p_org and m.user_id = auth.uid() and m.role = 'OWNER');
$$;

-- Enable RLS everywhere.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Profiles: users read/update their own row.
create policy profiles_self_read on profiles for select using (user_id = auth.uid());
create policy profiles_self_update on profiles for update using (user_id = auth.uid());
create policy profiles_self_insert on profiles for insert with check (user_id = auth.uid());

-- Organizations & memberships: members can read.
create policy organizations_member_read on organizations for select using (is_member(id) and deleted_at is null);
create policy memberships_member_read on memberships for select using (is_member(organization_id));

-- Sources: members read (labels + masked display only are exposed through views; declared_identifier is owner-only via API).
create policy payment_sources_member_read on payment_sources for select using (is_member(organization_id) and deleted_at is null);

-- Devices: members read health/status (no credential hash is ever selected by clients; column privileges below).
create policy devices_member_read on devices for select using (is_member(organization_id));
revoke select (credential_hash) on devices from anon, authenticated;

-- Records: members read their workspace's records (realtime updates for evidence_state changes).
create policy payment_records_member_read on payment_records for select using (is_member(organization_id));
create policy payment_matches_member_read on payment_matches for select using (is_member(organization_id));

-- Notification events: OWNER ONLY. Cashiers receive scoped candidates via the API.
create policy notification_events_owner_read on notification_events for select using (is_owner(organization_id));

-- Plans are public reference data.
create policy plans_public_read on plans for select using (true);

-- Everything else (invitations, pairing_sessions, pairing_attempts, proofs, proof_versions,
-- ingest_batches, audit_events, subscriptions, billing_events, ledgers, jobs, export_jobs,
-- quota_locks, diagnostics_consent) has NO client policy -> API only.

-- Realtime: publish only the tables clients may read and that carry live state.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
alter publication supabase_realtime add table payment_records, devices, payment_matches;

-- Private storage buckets (created idempotently). Access is via API-signed URLs only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('proof-images', 'proof-images', false, 26214400, array['image/jpeg','image/png','image/heic','image/webp']),
  ('exports', 'exports', false, 104857600, array['text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;
-- No storage.objects policies for anon/authenticated: only the service role (API) touches these buckets.
