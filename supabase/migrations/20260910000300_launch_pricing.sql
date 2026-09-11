-- Launch pricing: Free / Starter / Business. Existing paid customers retain
-- their entitlement under the renamed plan with no gap in access.
update plans
set monthly_record_allowance = 100,
    scanner_devices = 1,
    collector_devices = 1,
    receiving_sources = 1,
    members = 2,
    proof_image_retention_days = 30
where code = 'FREE';

insert into plans (code, display_name, monthly_record_allowance, scanner_devices, collector_devices, receiving_sources, members, proof_image_retention_days, app_store_product_id, play_store_product_id)
values
  ('STARTER', 'Starter', 500, 2, 1, 1, 2, 90, 'paytsek_starter_30_days', 'paytsek_starter_30_days'),
  ('BUSINESS', 'Business', 2000, 5, 2, 2, 3, 90, 'paytsek_business_30_days', 'paytsek_business_30_days')
on conflict (code) do update set
  display_name = excluded.display_name,
  monthly_record_allowance = excluded.monthly_record_allowance,
  scanner_devices = excluded.scanner_devices,
  collector_devices = excluded.collector_devices,
  receiving_sources = excluded.receiving_sources,
  members = excluded.members,
  proof_image_retention_days = excluded.proof_image_retention_days,
  app_store_product_id = excluded.app_store_product_id,
  play_store_product_id = excluded.play_store_product_id;

update subscriptions set plan_code = 'STARTER' where plan_code = 'SOLO';
update subscriptions set plan_code = 'BUSINESS' where plan_code = 'TEAM';
update organizations set plan_code = 'STARTER' where plan_code = 'SOLO';
update organizations set plan_code = 'BUSINESS' where plan_code = 'TEAM';

-- Old checkout links were priced under the retired launch model. Do not let a
-- stale link unexpectedly buy a retired product after the new pricing is live.
update billing_checkout_sessions
set status = 'CANCELLED'
where status = 'PENDING';

alter table billing_checkout_sessions drop constraint if exists billing_checkout_sessions_product_key_check;
alter table billing_checkout_sessions add constraint billing_checkout_sessions_product_key_check
  check (product_key in ('SOLO_MONTHLY', 'TEAM_MONTHLY', 'PACK_500', 'STARTER_30_DAYS', 'BUSINESS_30_DAYS'));
