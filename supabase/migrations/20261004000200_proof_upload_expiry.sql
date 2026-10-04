-- Signed uploads are bearer capabilities independent of workspace membership.
-- Retain their cleanup manifest until they expire, including legacy purged rows
-- which a still-valid old token could recreate. The one-day cutover hold covers
-- old untracked 2-hour tokens during deployment; retire old API revisions within
-- that window. Store timestamps only, never the token or URL.
alter table payment_proofs add column upload_authorized_until timestamptz;
update payment_proofs set upload_authorized_until=now()+interval '24 hours';
create index payment_proofs_upload_authorized_idx on payment_proofs(upload_authorized_until)
  where upload_authorized_until is not null;
