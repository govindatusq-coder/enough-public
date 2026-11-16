-- OPTIONAL. Load Bear does not need this: shares are stored as rows of the server's delivery account (see
-- lib/bear/server/robot-shares.ts). This table is used only if that account is unavailable.
-- Share Bear: responsibilities shared between two people (information, an action, or the whole responsibility).
-- Additive. A share is visible only to the person who sent it and the one person who claimed its link.
-- The link carries a random token; only its SHA-256 hash is stored. Claiming goes through bear_claim_share, because
-- before claiming, the recipient cannot see the row.
-- Rollback: drop function if exists public.bear_claim_share(text); drop table if exists public.bear_shares;
create table if not exists public.bear_shares (
 id uuid primary key,
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid references auth.users(id) on delete set null,
 token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
 mode text not null check (mode in ('info','action','transfer')),
 status text not null check (status in ('invited','accepted','discussing','declined','done','revoked')),
 body jsonb not null check (jsonb_typeof(body)='object' and octet_length(body::text)<=16384),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists bear_shares_sender on public.bear_shares(sender_id);
create index if not exists bear_shares_recipient on public.bear_shares(recipient_id);
alter table public.bear_shares enable row level security;
create policy shares_select on public.bear_shares for select to authenticated
 using ((select auth.uid()) in (sender_id,recipient_id));
create policy shares_insert on public.bear_shares for insert to authenticated
 with check ((select auth.uid())=sender_id and recipient_id is null and status='invited'
  and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy shares_update on public.bear_shares for update to authenticated
 using ((select auth.uid()) in (sender_id,recipient_id))
 with check ((select auth.uid()) in (sender_id,recipient_id));
create policy shares_delete on public.bear_shares for delete to authenticated
 using ((select auth.uid())=sender_id);
grant select,insert,update,delete on public.bear_shares to authenticated;
revoke all on public.bear_shares from anon;

-- Who it is between, how it was shared and its link never change through a normal update.
create or replace function public.bear_shares_guard() returns trigger language plpgsql as $$
begin
 if new.sender_id<>old.sender_id or new.token_hash<>old.token_hash or new.mode<>old.mode
    or new.recipient_id is distinct from old.recipient_id and current_setting('bear.claiming',true) is distinct from 'on'
    and not (new.recipient_id is null and old.recipient_id=(select auth.uid())) then
  raise exception 'bear_shares: these fields cannot change';
 end if;
 -- Only the sender can take a share back; only the recipient can accept, decline, discuss or finish it.
 if new.status<>old.status then
  if new.status='revoked' and (select auth.uid())<>old.sender_id then raise exception 'bear_shares: only the sender can take it back'; end if;
  if new.status in ('accepted','declined','discussing','done') and (select auth.uid()) is distinct from old.recipient_id and new.recipient_id is not null then raise exception 'bear_shares: only the recipient can answer'; end if;
 end if;
 return new;
end $$;
drop trigger if exists bear_shares_guard on public.bear_shares;
create trigger bear_shares_guard before update on public.bear_shares for each row execute function public.bear_shares_guard();

-- The first signed-in person (other than the sender) to open the link becomes its recipient. Returns the share id,
-- or null if the link is unknown, already claimed by someone else, or taken back.
create or replace function public.bear_claim_share(p_token_hash text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_sender uuid; v_recipient uuid; v_status text;
begin
 if (select auth.uid()) is null or coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) then return null; end if;
 select id,sender_id,recipient_id,status into v_id,v_sender,v_recipient,v_status from public.bear_shares where token_hash=p_token_hash for update;
 if v_id is null then return null; end if;
 if v_sender=(select auth.uid()) or v_recipient=(select auth.uid()) then return v_id; end if;
 if v_recipient is not null or v_status<>'invited' then return null; end if;
 perform set_config('bear.claiming','on',true);
 update public.bear_shares set recipient_id=(select auth.uid()),updated_at=now() where id=v_id;
 perform set_config('bear.claiming','off',true);
 return v_id;
end $$;
revoke all on function public.bear_claim_share(text) from public, anon;
grant execute on function public.bear_claim_share(text) to authenticated;
