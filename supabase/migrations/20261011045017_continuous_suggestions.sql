-- Keep suggestions independently of the bounded account snapshot.
create table public.enough_ideas (
 user_id uuid not null references public.enough_accounts(user_id) on delete cascade,
 idea_id integer not null check(idea_id>=1000),
 idea_json jsonb not null check(jsonb_typeof(idea_json)='object' and octet_length(idea_json::text)<=8192),
 sequence bigint generated always as identity,
 created_at timestamptz not null default now(),
 title_key text generated always as (lower(btrim(idea_json->>'title'))) stored not null,
 primary key(user_id,idea_id),
 unique(user_id,title_key),
 check((idea_json->>'id')::integer=idea_id and (idea_json->>'source') is not distinct from 'ai' and length(title_key) between 1 and 100)
);
create index enough_ideas_owner_sequence on public.enough_ideas(user_id,sequence desc);
alter table public.enough_ideas enable row level security;
create policy own_ideas_read on public.enough_ideas for select to authenticated
 using((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy own_ideas_write on public.enough_ideas for insert to authenticated
 with check((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
revoke all on public.enough_ideas from public,anon,authenticated;
grant select,insert on public.enough_ideas to authenticated;
revoke all on sequence public.enough_ideas_sequence_seq from public,anon,authenticated;
grant usage on sequence public.enough_ideas_sequence_seq to authenticated;

-- Preserve existing suggestions in their original order.
insert into public.enough_ideas(user_id,idea_id,idea_json)
 select a.user_id,(row.idea->>'id')::integer,row.idea
 from public.enough_accounts a cross join lateral jsonb_array_elements(coalesce(a.state_json->'generated','[]'::jsonb)) with ordinality as row(idea,position)
 order by a.updated_at,row.position
 on conflict do nothing;

create function public.enough_keep_ideas(p_ideas jsonb) returns table(idea_json jsonb)
 language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required';end if;
 if jsonb_typeof(p_ideas) is distinct from 'array' or jsonb_array_length(p_ideas)>10 then raise exception 'Expected a suggestion batch';end if;
 return query insert into public.enough_ideas(user_id,idea_id,idea_json)
  select auth.uid(),(row.idea->>'id')::integer,row.idea from jsonb_array_elements(p_ideas) with ordinality as row(idea,position) order by row.position
  on conflict do nothing returning enough_ideas.idea_json;
end $$;
revoke all on function public.enough_keep_ideas(jsonb) from public,anon;
grant execute on function public.enough_keep_ideas(jsonb) to authenticated;

-- Account imports and saves also preserve their generated ideas. A stale
-- revision archives nothing, and a failed archive rolls the save back.
create or replace function public.enough_save_account(p_state jsonb,p_revision integer)
returns table(revision integer,updated_at timestamptz)
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or p_revision<0 then raise exception 'Authentication and a valid revision required';end if;
 if p_revision=0 then
  return query insert into public.enough_accounts(user_id,state_json) values(auth.uid(),p_state)
   on conflict(user_id) do nothing returning enough_accounts.revision,enough_accounts.updated_at;
 else
  return query update public.enough_accounts a set state_json=p_state,revision=a.revision+1,updated_at=now()
   where a.user_id=auth.uid() and a.revision=p_revision returning a.revision,a.updated_at;
 end if;
 if found then
  insert into public.enough_ideas(user_id,idea_id,idea_json)
   select auth.uid(),(row.idea->>'id')::integer,row.idea from jsonb_array_elements(coalesce(p_state->'generated','[]'::jsonb)) with ordinality as row(idea,position) order by row.position
   on conflict do nothing;
 end if;
end $$;

-- Replace the daily cap with a single active request per account. The lease
-- expires after the route's five-minute maximum even if a process exits.
create table enough_private.ai_requests (
 user_id uuid primary key references public.enough_accounts(user_id) on delete cascade,
 request_id uuid not null,
 expires_at timestamptz not null
);
alter table enough_private.ai_requests enable row level security;
create policy own_request_defense on enough_private.ai_requests for select to authenticated using((select auth.uid())=user_id);
revoke all on enough_private.ai_requests from public,anon,authenticated;
create function enough_private.begin_ai_request(p_request_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare acquired uuid;
begin
 if auth.uid() is null or p_request_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required';end if;
 insert into enough_private.ai_requests(user_id,request_id,expires_at) values(auth.uid(),p_request_id,now()+interval '6 minutes')
 on conflict(user_id) do update set request_id=excluded.request_id,expires_at=excluded.expires_at
  where ai_requests.expires_at<=now() returning request_id into acquired;
 return acquired is not null;
end $$;
create function enough_private.end_ai_request(p_request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required';end if;
 delete from enough_private.ai_requests where user_id=auth.uid() and request_id=p_request_id;
end $$;
revoke all on function enough_private.begin_ai_request(uuid),enough_private.end_ai_request(uuid) from public,anon;
grant execute on function enough_private.begin_ai_request(uuid),enough_private.end_ai_request(uuid) to authenticated;
create function public.enough_begin_ai_request(p_request_id uuid) returns boolean
 language sql security invoker set search_path='' as $$select enough_private.begin_ai_request(p_request_id)$$;
create function public.enough_end_ai_request(p_request_id uuid) returns void
 language sql security invoker set search_path='' as $$select enough_private.end_ai_request(p_request_id)$$;
revoke all on function public.enough_begin_ai_request(uuid),public.enough_end_ai_request(uuid) from public,anon;
grant execute on function public.enough_begin_ai_request(uuid),public.enough_end_ai_request(uuid) to authenticated;

-- Compatibility during deployment: the old endpoint can no longer exhaust a
-- daily allowance. New code uses the request lease above instead.
create or replace function enough_private.take_ai_slot() returns integer language plpgsql security definer set search_path='' as $$
declare result integer;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required';end if;
 insert into enough_private.ai_runs(user_id,day,count) values(auth.uid(),(now() at time zone 'UTC')::date,1)
 on conflict(user_id,day) do update set count=ai_runs.count+1 returning count into result;
 return result;
end $$;
