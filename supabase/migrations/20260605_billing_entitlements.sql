create table if not exists public.billing_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',
  access_status text not null default 'inactive',
  access_until timestamptz,
  lemon_order_id text,
  lemon_subscription_id text,
  lemon_variant_id text,
  updated_at timestamptz not null default now()
);

alter table public.billing_entitlements enable row level security;

create policy "Users can view their own billing access"
on public.billing_entitlements
for select
using (auth.uid() = user_id);
