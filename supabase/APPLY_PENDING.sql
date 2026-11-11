
-- ===== 20261108120000_bear_inbound_email =====
-- Load Bear 2.0: Forward-to-Bear (inbound email). Additive and backward compatible: two new tables,
-- nothing existing is changed. Used only by the server with the service-role key; owners can read
-- their own route. Message keys are stored as hashes; no subject, sender or body is ever stored here.
--
-- Rollback (safe at any time; forwarding simply stops):
--   drop table if exists public.bear_inbound_messages;
--   drop table if exists public.bear_inbound_routes;

create table if not exists public.bear_inbound_routes (
 token text primary key check (token ~ '^[a-z2-7]{26}$'),
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 revoked_at timestamptz
);
create unique index if not exists bear_inbound_routes_one_live on public.bear_inbound_routes(user_id) where revoked_at is null;
alter table public.bear_inbound_routes enable row level security;
drop policy if exists own_route_read on public.bear_inbound_routes;
create policy own_route_read on public.bear_inbound_routes for select to authenticated using (user_id = auth.uid());
revoke all on public.bear_inbound_routes from anon;
grant select on public.bear_inbound_routes to authenticated;

create table if not exists public.bear_inbound_messages (
 user_id uuid not null references auth.users(id) on delete cascade,
 message_key text not null check (char_length(message_key) <= 128),
 status text not null check (status in ('processing','done','ignored')),
 created_at timestamptz not null default now(),
 primary key (user_id, message_key)
);
alter table public.bear_inbound_messages enable row level security;
revoke all on public.bear_inbound_messages from anon, authenticated;
-- Housekeeping: idempotency keys are only needed while a provider might retry (about a day).
create index if not exists bear_inbound_messages_created on public.bear_inbound_messages(created_at);

-- ===== 20261109120000_bear_responsibility_events =====
-- Responsibility Engine: append-only lifecycle event log. Additive; nothing existing changes.
-- Owners can read and insert their own events; nobody (except the service role) can update or delete,
-- so the history can't be rewritten from the app. Bodies hold minimal metadata, never notice text.
--
-- Rollback: drop table if exists public.bear_responsibility_events;
create table if not exists public.bear_responsibility_events (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 responsibility_id uuid not null,
 event_type text not null,
 at timestamptz not null,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=16384),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists bear_responsibility_events_resp on public.bear_responsibility_events(user_id,responsibility_id,at);
alter table public.bear_responsibility_events enable row level security;
drop policy if exists own_events_read on public.bear_responsibility_events;
create policy own_events_read on public.bear_responsibility_events for select to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
drop policy if exists own_events_insert on public.bear_responsibility_events;
create policy own_events_insert on public.bear_responsibility_events for insert to authenticated
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert on public.bear_responsibility_events to authenticated;
revoke update,delete on public.bear_responsibility_events from authenticated;
revoke all on public.bear_responsibility_events from anon;

-- ===== 20261109130000_bear_enterprise =====
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

-- ===== 20261110120000_bear_study_responses =====
-- Research study survey answers (opt-in). Additive. Owner-only, like every bear_* table. Answers are numbers
-- only (no free text). The researcher export runs with the service role and pseudonymises participants.
-- Rollback: drop table if exists public.bear_study_responses;
create table if not exists public.bear_study_responses (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 phase text not null check (phase in ('baseline','weekly','end')),
 instrument text not null check (instrument in ('tlx','sus','weekly','context')),
 week integer not null check (week between 0 and 6),
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=8192),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists bear_study_responses_user on public.bear_study_responses(user_id,phase,week);
alter table public.bear_study_responses enable row level security;
drop policy if exists own_rows on public.bear_study_responses;
create policy own_rows on public.bear_study_responses to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,delete on public.bear_study_responses to authenticated;
revoke update on public.bear_study_responses from authenticated;
revoke all on public.bear_study_responses from anon;

-- ===== 20261111120000_bear_connected_accounts =====
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
drop policy if exists own_rows on public.bear_connected_accounts;
create policy own_rows on public.bear_connected_accounts to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_connected_accounts to authenticated;
revoke all on public.bear_connected_accounts from anon;

-- ===== 20261112120000_bear_delete_my_data =====
-- Load Bear: let a signed-in person delete ALL of their own Load Bear data in one call. Additive: creates one function.
-- It runs as the function owner (so it can also remove the append-only event log, which people cannot delete row by row), but only
-- ever touches rows where user_id = the caller (auth.uid()). It skips any table that doesn't exist yet, so it works whichever
-- earlier migrations have been applied. Stored files are removed by the app (with the person's own session) before this runs.
-- Rollback: drop function if exists public.bear_delete_my_data();
create or replace function public.bear_delete_my_data() returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); t text;
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'not allowed'; end if;
 foreach t in array array['responsibility_events','connected_accounts','study_responses','push_subscriptions','reminder_interactions','reminders','wins','completions','value_ledger',
   'behaviour_events','suggestions','recurring_expectations','bills','task_dependencies','tasks','projects','user_corrections','ai_inferences','extractions','source_documents','captures','people','areas',
   'inbound_messages','inbound_routes','profiles'] loop
  if to_regclass('public.bear_'||t) is not null then execute format('delete from public.%I where user_id=$1','bear_'||t) using uid; end if;
 end loop;
end $$;
revoke all on function public.bear_delete_my_data() from public,anon;
grant execute on function public.bear_delete_my_data() to authenticated;

-- ===== 20261112121000_bear_job_runs =====
-- Background job visibility and a run lock. One row per run of a scheduled job. The unique (job, run_key) means two runs started in the
-- same window cannot both proceed (the second sees the row and exits), and the table answers "did the reminder job run, and did it fail?".
-- Service role only: no policy and no grants for signed-in users. Holds counts only, never anything about a family.
-- Rollback: drop table if exists public.bear_job_runs;
create table if not exists public.bear_job_runs (
 job text not null,
 run_key text not null,
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 status text not null default 'running' check (status in ('running','ok','failed','skipped')),
 delivered integer not null default 0,
 failed integer not null default 0,
 note text,
 primary key (job,run_key)
);
alter table public.bear_job_runs enable row level security;
revoke all on public.bear_job_runs from anon,authenticated;
