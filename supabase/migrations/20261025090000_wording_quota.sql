-- Daily allowance for AI wording of an already-chosen opportunity
-- (POST /api/personalise). Each signed-in person may ask for at most 40
-- rewordings per UTC day. Once it is used, or if this check fails, the app
-- keeps its deterministic template copy and no model request is made.
create table enough_private.wording_runs(
 user_id uuid not null references public.enough_accounts(user_id) on delete cascade,
 day date not null,
 count integer not null,
 primary key(user_id,day)
);
alter table enough_private.wording_runs enable row level security;
revoke all on enough_private.wording_runs from public,anon,authenticated;

create function enough_private.take_wording_slot() returns boolean language plpgsql security definer set search_path='' as $$
declare result integer;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required';end if;
 insert into enough_private.wording_runs(user_id,day,count) values(auth.uid(),(now() at time zone 'UTC')::date,1)
 on conflict(user_id,day) do update set count=wording_runs.count+1 where wording_runs.count<40 returning count into result;
 return result is not null;
end $$;
revoke all on function enough_private.take_wording_slot() from public,anon;
grant execute on function enough_private.take_wording_slot() to authenticated;

create function public.enough_take_wording_slot() returns boolean
 language sql security invoker set search_path='' as $$select enough_private.take_wording_slot()$$;
revoke all on function public.enough_take_wording_slot() from public,anon;
grant execute on function public.enough_take_wording_slot() to authenticated;
