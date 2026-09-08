-- Add Maya as a recordable provider.
--
-- Recording and manual confirmation only: no verified Maya incoming-payment
-- notification sample exists yet, so no flow in packages/receipt-parsers
-- registry.ts sets autoMatchEnabled for MAYA, and there is no Maya notification
-- adapter. See docs/provider-support-matrix.md.
--
-- `alter type ... add value` cannot run inside a transaction block on older
-- Postgres, and is not idempotent on its own, so each value is guarded.

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'provider' and e.enumlabel = 'MAYA'
  ) then
    alter type provider add value 'MAYA';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'reference_namespace' and e.enumlabel = 'MAYA_REF_NO'
  ) then
    alter type reference_namespace add value 'MAYA_REF_NO';
  end if;
end
$$;
