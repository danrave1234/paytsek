-- Add MariBank as a recordable provider.
--
-- MariBank Philippines is the rebranded SeaBank Philippines (BSP digital
-- banking licence, 2025), which is why the Android package allowlist still
-- carries the SeaBank identifier `ph.seabank.seabank`.
--
-- Recording and manual confirmation only: no verified MariBank incoming-payment
-- notification sample exists yet, so no flow in packages/receipt-parsers
-- registry.ts sets autoMatchEnabled for MARIBANK, and its notification adapter
-- fails closed. See docs/provider-support-matrix.md.

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'provider' and e.enumlabel = 'MARIBANK'
  ) then
    alter type provider add value 'MARIBANK';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'reference_namespace' and e.enumlabel = 'MARIBANK_REF_NO'
  ) then
    alter type reference_namespace add value 'MARIBANK_REF_NO';
  end if;
end
$$;
