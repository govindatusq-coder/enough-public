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
