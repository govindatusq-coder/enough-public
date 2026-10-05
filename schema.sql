-- ENOUGH public hosting: applied remotely using Supabase migration enough_public_accounts.
create table public.enough_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 state_json jsonb not null check(jsonb_typeof(state_json)='object' and octet_length(state_json::text)<=1048576),
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
alter table public.enough_accounts enable row level security;
create policy own_account on public.enough_accounts to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.enough_accounts to authenticated;
revoke all on public.enough_accounts from anon;

create function public.enough_save_account(p_state jsonb,p_revision integer)
returns table(revision integer,updated_at timestamptz)
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or p_revision<0 then raise exception 'Authentication and a valid revision required'; end if;
 if p_revision=0 then
  return query insert into public.enough_accounts(user_id,state_json) values(auth.uid(),p_state)
   on conflict(user_id) do nothing returning enough_accounts.revision,enough_accounts.updated_at;
 else
  return query update public.enough_accounts a set state_json=p_state,revision=a.revision+1,updated_at=now()
   where a.user_id=auth.uid() and a.revision=p_revision returning a.revision,a.updated_at;
 end if;
end $$;
revoke all on function public.enough_save_account(jsonb,integer) from public,anon;
grant execute on function public.enough_save_account(jsonb,integer) to authenticated;

create table public.enough_photos (
 id uuid primary key,
 user_id uuid not null references public.enough_accounts(user_id) on delete cascade,
 entry_id text not null check(length(entry_id)<=100),
 object_key text not null unique,
 caption text not null default '' check(length(caption)<=200),
 created_at timestamptz not null default now(),
 check(object_key=user_id::text||'/'||id::text||'.jpg')
);
create index enough_photos_owner_created on public.enough_photos(user_id,created_at desc);
create index enough_photos_owner_entry on public.enough_photos(user_id,entry_id);
alter table public.enough_photos enable row level security;
create policy own_photos on public.enough_photos to authenticated
 using ((select auth.uid())=user_id)
 with check ((select auth.uid())=user_id);
grant select,insert,delete on public.enough_photos to authenticated;
revoke all on public.enough_photos from anon;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('enough-photos','enough-photos',false,2097152,array['image/jpeg']);
create policy enough_photo_read on storage.objects for select to authenticated
 using(bucket_id='enough-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy enough_photo_write on storage.objects for insert to authenticated
 with check(bucket_id='enough-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and
  exists(select 1 from public.enough_accounts a where a.user_id=(select auth.uid())));
create policy enough_photo_delete on storage.objects for delete to authenticated
 using(bucket_id='enough-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- The quota cannot be reset through the client Data API. Privileged code is internal,
-- checks auth.uid(), and never accepts a caller-supplied owner or day.
create schema if not exists enough_private;
revoke all on schema enough_private from public,anon;
grant usage on schema enough_private to authenticated;
create table enough_private.ai_runs(user_id uuid not null references public.enough_accounts(user_id) on delete cascade,day date not null,count integer not null,primary key(user_id,day));
alter table enough_private.ai_runs enable row level security;
revoke all on enough_private.ai_runs from public,anon,authenticated;
create function enough_private.take_ai_slot() returns integer language plpgsql security definer set search_path='' as $$
declare result integer;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required';end if;
 insert into enough_private.ai_runs(user_id,day,count) values(auth.uid(),(now() at time zone 'UTC')::date,1)
 on conflict(user_id,day) do update set count=ai_runs.count+1 where ai_runs.count<5 returning count into result;
 return result;
end $$;
revoke all on function enough_private.take_ai_slot() from public,anon;
grant execute on function enough_private.take_ai_slot() to authenticated;
create function public.enough_take_ai_slot() returns integer language sql security invoker set search_path='' as $$select enough_private.take_ai_slot()$$;
revoke all on function public.enough_take_ai_slot() from public,anon;
grant execute on function public.enough_take_ai_slot() to authenticated;

create policy own_quota_defense on enough_private.ai_runs for select to authenticated using ((select auth.uid())=user_id);
