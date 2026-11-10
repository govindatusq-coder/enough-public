-- Connected accounts (Outlook calendar). Additive. One row per person per provider. The body holds the access and refresh
-- tokens ENCRYPTED (AES-256-GCM, key in an environment variable the database never sees), so a database leak alone
-- exposes no usable token. Owner-only; the owner can delete the row to disconnect.
-- Rollback: drop table if exists public.bear_connected_accounts;
create table if not exists public.bear_connected_accounts (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check (provider in ('microsoft')),
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=8192),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (user_id,provider)
);
alter table public.bear_connected_accounts enable row level security;
create policy own_rows on public.bear_connected_accounts to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_connected_accounts to authenticated;
revoke all on public.bear_connected_accounts from anon;
