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
create policy own_events_read on public.bear_responsibility_events for select to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy own_events_insert on public.bear_responsibility_events for insert to authenticated
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert on public.bear_responsibility_events to authenticated;
revoke update,delete on public.bear_responsibility_events from authenticated;
revoke all on public.bear_responsibility_events from anon;
