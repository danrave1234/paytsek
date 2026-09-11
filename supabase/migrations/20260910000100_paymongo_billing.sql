-- PayMongo is the direct billing provider for side-loaded PayTsek builds.
alter table subscriptions alter column revenuecat_app_user_id drop not null;
alter table subscriptions drop constraint if exists subscriptions_store_check;
alter table subscriptions add constraint subscriptions_store_check check (store in ('APP_STORE','PLAY_STORE','PAYMONGO'));
alter table billing_events add column if not exists provider text not null default 'REVENUECAT';
alter table billing_events add constraint billing_events_provider_check check (provider in ('REVENUECAT','PAYMONGO'));

create table billing_checkout_sessions (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  billing_owner_user_id uuid not null references auth.users(id) on delete restrict,
  product_key text not null check (product_key in ('SOLO_MONTHLY','TEAM_MONTHLY','PACK_500')),
  provider_link_id text not null unique,
  provider_payment_id text unique,
  checkout_url text not null,
  status text not null check (status in ('PENDING','PAID','EXPIRED','CANCELLED')),
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index billing_checkout_sessions_open_idx on billing_checkout_sessions(organization_id, billing_owner_user_id, product_key, expires_at) where status = 'PENDING';
create trigger billing_checkout_sessions_updated_at before update on billing_checkout_sessions for each row execute function set_updated_at();
