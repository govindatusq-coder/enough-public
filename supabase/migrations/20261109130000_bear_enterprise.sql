-- Enterprise API (v1): tenants, hashed API keys, tenant members and idempotency records. Additive.
-- Server-only (service role). No policies grant access to app users: RLS is on with no policies, so these
-- tables are invisible to authenticated and anonymous clients.
-- Rollback: drop table if exists public.bear_api_idempotency, public.bear_tenant_members, public.bear_tenant_keys, public.bear_tenants;
create table if not exists public.bear_tenants (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(name) between 1 and 120),
 brand jsonb not null default '{}'::jsonb check (octet_length(brand::text)<=4096),
 features text[] not null default '{}',
 status text not null default 'active' check (status in ('active','suspended')),
 created_at timestamptz not null default now()
);
create table if not exists public.bear_tenant_keys (
 key_hash text primary key check (char_length(key_hash)=64),
 tenant_id uuid not null references public.bear_tenants(id) on delete cascade,
 label text,
 created_at timestamptz not null default now(),
 revoked_at timestamptz
);
create table if not exists public.bear_tenant_members (
 tenant_id uuid not null references public.bear_tenants(id) on delete cascade,
 external_id text not null check (char_length(external_id) between 1 and 128),
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'active' check (status in ('active','deprovisioned')),
 created_at timestamptz not null default now(),
 primary key (tenant_id, external_id),
 unique (user_id)
);
create table if not exists public.bear_api_idempotency (
 tenant_id uuid not null references public.bear_tenants(id) on delete cascade,
 key_hash text not null,
 status integer not null,
 body jsonb not null,
 created_at timestamptz not null default now(),
 primary key (tenant_id, key_hash)
);
alter table public.bear_tenants enable row level security;
alter table public.bear_tenant_keys enable row level security;
alter table public.bear_tenant_members enable row level security;
alter table public.bear_api_idempotency enable row level security;
revoke all on public.bear_tenants, public.bear_tenant_keys, public.bear_tenant_members, public.bear_api_idempotency from anon, authenticated;
