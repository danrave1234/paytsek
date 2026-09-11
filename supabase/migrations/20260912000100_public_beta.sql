-- Public beta: no purchase is required and ordinary teams should not hit a
-- record or setup ceiling while the workflow is being validated. Billing data
-- is intentionally preserved for a future formal launch.
update plans
set monthly_record_allowance = 1000000,
    scanner_devices = 10,
    collector_devices = 5,
    receiving_sources = 5,
    members = 10,
    proof_image_retention_days = 90
where code = 'FREE';
