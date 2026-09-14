-- V2: a proof is a durable record even when notification listening has not
-- been configured. A receiving source is attached only when it is known.
alter table payment_records alter column source_id drop not null;

-- Older clients allowed the same wallet provider to be added repeatedly.
-- Keep the most useful row visible and preserve every historical foreign key
-- on the soft-deleted rows for audit integrity.
with ranked as (
  select s.id,
         row_number() over (
           partition by s.organization_id, s.provider
           order by
             exists (
               select 1 from device_bindings b
                where b.source_id = s.id and b.status = 'ACTIVE'
             ) desc,
             s.is_default desc,
             s.created_at,
             s.id
         ) as position
    from payment_sources s
   where s.deleted_at is null
), duplicates as (
  select id from ranked where position > 1
)
update payment_sources s
   set deleted_at = now(), is_default = false
  from duplicates d
 where s.id = d.id;

update device_bindings b
   set status = 'REVOKED', revoked_at = coalesce(revoked_at, now())
 where b.status = 'ACTIVE'
   and exists (
     select 1 from payment_sources s
      where s.id = b.source_id and s.deleted_at is not null
   );

update pairing_sessions p
   set state = 'EXPIRED'
 where p.state in ('PENDING', 'ACCEPTED')
   and exists (
     select 1 from payment_sources s
      where s.id = p.source_id and s.deleted_at is not null
   );

create unique index payment_sources_one_active_provider_idx
  on payment_sources(organization_id, provider)
  where deleted_at is null;

-- Nullable source_id is valid only for proof records. The other tables that
-- use this trigger retain NOT NULL columns.
create or replace function check_source_owner() returns trigger language plpgsql as $$
declare s_org uuid;
begin
  if new.source_id is null then
    return new;
  end if;
  select organization_id into s_org from payment_sources where id = new.source_id;
  if s_org is null or s_org <> new.organization_id then
    raise exception 'source does not belong to organization' using errcode = '23514';
  end if;
  return new;
end $$;

-- A notification match still requires an exact receiving source. Server code
-- assigns the event's source before creating a match for an unscoped proof.
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
    if r_source is null or e_source is distinct from r_source then
      raise exception 'event source does not match record source' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
