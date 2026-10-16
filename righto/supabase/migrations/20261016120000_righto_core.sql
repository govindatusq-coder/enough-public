-- Righto backend · core schema, row-level security, invites, audit log.
-- Target: Supabase project in ap-southeast-2 (Sydney). Paste into the SQL editor or apply with `supabase db push`.
-- Design rules (PRIVACY.md, INTENDED_PURPOSE.md, COMPLIANCE_REVIEW.md):
--   * a client reads and writes only their own rows;
--   * a psychologist reads a client's record only through righto_client_record(), which checks an active link,
--     hides anything the client has not shared, requires MFA, and writes an audit row;
--   * invites are single-use, expire in 48 h, and are stored hashed;
--   * no scores, no interpretation: the server stores records and counts nothing.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------------------------- settings
create table public.righto_settings (
  key text primary key,
  value jsonb not null
);
insert into public.righto_settings(key, value) values ('require_psych_mfa', 'true'::jsonb);
revoke all on public.righto_settings from public, anon, authenticated;

create function public.righto_setting(p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select value from public.righto_settings where key = p_key
$$;
revoke all on function public.righto_setting(text) from public, anon;

-- ---------------------------------------------------------------------------------------------- helpers
create function public.righto_uid() returns uuid
language sql stable set search_path = '' as $$
  select case when coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then null else auth.uid() end
$$;

create function public.righto_require_psych() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := public.righto_uid();
begin
  if v_uid is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if not exists (select 1 from public.righto_profiles p where p.user_id = v_uid and p.role = 'psych') then
    raise exception 'Psychologist account required' using errcode = '42501';
  end if;
  if coalesce((public.righto_setting('require_psych_mfa'))::boolean, true) and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'Multi-factor authentication required' using errcode = '42501';
  end if;
  return v_uid;
end $$;
revoke all on function public.righto_require_psych() from public, anon;

create function public.righto_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------------------------------------- profiles
create table public.righto_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('client', 'psych')),
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  consent_version text,
  consent_at timestamptz,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and octet_length(settings::text) <= 4096),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger righto_profiles_touch before update on public.righto_profiles for each row execute function public.righto_touch();
alter table public.righto_profiles enable row level security;
create policy profiles_own_read on public.righto_profiles for select to authenticated using (user_id = public.righto_uid());
create policy profiles_own_insert on public.righto_profiles for insert to authenticated with check (user_id = public.righto_uid());
create policy profiles_own_update on public.righto_profiles for update to authenticated using (user_id = public.righto_uid()) with check (user_id = public.righto_uid() and role = (select p.role from public.righto_profiles p where p.user_id = public.righto_uid()));
revoke all on public.righto_profiles from public, anon, authenticated;
grant select, insert, update on public.righto_profiles to authenticated;

-- Psychologist details shown to clients when they confirm an invite.
create table public.righto_psychologists (
  user_id uuid primary key references public.righto_profiles(user_id) on delete cascade,
  title text not null default 'Psychologist' check (length(title) <= 40),
  practice text not null default '' check (length(practice) <= 120),
  ahpra text not null default '' check (length(ahpra) <= 20),
  consent_attested_at timestamptz, -- "I have my client's consent to use Righto as part of their care"
  created_at timestamptz not null default now()
);
alter table public.righto_psychologists enable row level security;
create policy psych_own_all on public.righto_psychologists for all to authenticated
  using (user_id = public.righto_uid()) with check (user_id = public.righto_uid());
revoke all on public.righto_psychologists from public, anon, authenticated;
grant select, insert, update on public.righto_psychologists to authenticated;

-- ---------------------------------------------------------------------------------------------- links & invites
create table public.righto_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.righto_profiles(user_id) on delete cascade,
  psych_id uuid not null references public.righto_profiles(user_id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by text check (ended_by in ('client', 'psych')),
  unique (client_id, psych_id)
);
create index righto_links_psych on public.righto_links(psych_id) where active;
alter table public.righto_links enable row level security;
create policy links_read on public.righto_links for select to authenticated
  using (client_id = public.righto_uid() or psych_id = public.righto_uid());
revoke all on public.righto_links from public, anon, authenticated;
grant select on public.righto_links to authenticated;

create function public.righto_active_link(p_client uuid, p_psych uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.righto_links l where l.client_id = p_client and l.psych_id = p_psych and l.active)
$$;
revoke all on function public.righto_active_link(uuid, uuid) from public, anon;

create table public.righto_invites (
  id uuid primary key default gen_random_uuid(),
  psych_id uuid not null references public.righto_profiles(user_id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.righto_profiles(user_id),
  created_at timestamptz not null default now()
);
create index righto_invites_psych on public.righto_invites(psych_id, created_at desc);
alter table public.righto_invites enable row level security;
-- No direct access: invites are created, previewed and redeemed through the functions below.
revoke all on public.righto_invites from public, anon, authenticated;

create function public.righto_hash_code(p_code text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex')
$$;

-- Psychologist: mint a single-use, 48-hour invite. Returns the code once; only its hash is stored.
create function public.righto_create_invite() returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_psych uuid := public.righto_require_psych(); v_code text; v_exp timestamptz := now() + interval '48 hours';
begin
  if (select count(*) from public.righto_invites i where i.psych_id = v_psych and i.created_at > now() - interval '1 day') >= 20 then
    raise exception 'Invite limit reached for today' using errcode = '54000';
  end if;
  -- 10 characters from an unambiguous alphabet: ~50 bits of entropy.
  v_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
             from generate_series(1, 10));
  insert into public.righto_invites(psych_id, code_hash, expires_at) values (v_psych, public.righto_hash_code(v_code), v_exp);
  return query select v_code, v_exp;
end $$;
revoke all on function public.righto_create_invite() from public, anon;

-- Client: see who the invite is from before linking (name, title, practice, Ahpra number, hours left).
create function public.righto_preview_invite(p_code text) returns table (display_name text, title text, practice text, ahpra text, expires_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.righto_uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  return query
    select pr.display_name, ps.title, ps.practice, ps.ahpra, i.expires_at
    from public.righto_invites i
    join public.righto_profiles pr on pr.user_id = i.psych_id
    left join public.righto_psychologists ps on ps.user_id = i.psych_id
    where i.code_hash = public.righto_hash_code(p_code) and i.used_at is null and i.expires_at > now();
end $$;
revoke all on function public.righto_preview_invite(text) from public, anon;

-- Client: redeem the invite. Single use; creates (or re-activates) the link.
create function public.righto_redeem_invite(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.righto_uid(); v_inv public.righto_invites%rowtype; v_link uuid;
begin
  if v_uid is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if not exists (select 1 from public.righto_profiles p where p.user_id = v_uid and p.role = 'client') then
    raise exception 'Client account required' using errcode = '42501';
  end if;
  select * into v_inv from public.righto_invites i where i.code_hash = public.righto_hash_code(p_code) for update;
  if v_inv.id is null or v_inv.used_at is not null or v_inv.expires_at <= now() then
    raise exception 'This invite is not valid any more. Ask your psychologist for a new one.' using errcode = '22023';
  end if;
  update public.righto_invites set used_at = now(), used_by = v_uid where id = v_inv.id;
  insert into public.righto_links(client_id, psych_id) values (v_uid, v_inv.psych_id)
    on conflict (client_id, psych_id) do update set active = true, ended_at = null, ended_by = null
    returning id into v_link;
  return v_link;
end $$;
revoke all on function public.righto_redeem_invite(text) from public, anon;

-- Either side can end sharing. The psychologist loses access to anything new immediately (APP 6).
create function public.righto_end_link(p_link uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.righto_uid(); v_l public.righto_links%rowtype;
begin
  select * into v_l from public.righto_links where id = p_link;
  if v_l.id is null or (v_l.client_id <> v_uid and v_l.psych_id <> v_uid) then raise exception 'Not found' using errcode = '42501'; end if;
  update public.righto_links set active = false, ended_at = now(), ended_by = case when v_l.client_id = v_uid then 'client' else 'psych' end where id = p_link;
end $$;
revoke all on function public.righto_end_link(uuid) from public, anon;

-- ---------------------------------------------------------------------------------------------- sessions
create table public.righto_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.righto_profiles(user_id) on delete cascade,
  psych_id uuid not null references public.righto_profiles(user_id) on delete cascade,
  starts_at timestamptz not null,
  mode text not null default 'in person' check (length(mode) <= 40),
  created_at timestamptz not null default now()
);
create index righto_sessions_client on public.righto_sessions(client_id, starts_at);
alter table public.righto_sessions enable row level security;
create policy sessions_client_read on public.righto_sessions for select to authenticated using (client_id = public.righto_uid());
create policy sessions_psych_all on public.righto_sessions for all to authenticated
  using (psych_id = public.righto_uid() and public.righto_active_link(client_id, psych_id))
  with check (psych_id = public.righto_uid() and public.righto_active_link(client_id, psych_id));
revoke all on public.righto_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.righto_sessions to authenticated;

-- ---------------------------------------------------------------------------------------------- tasks
create table public.righto_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.righto_profiles(user_id) on delete cascade,
  psych_id uuid not null references public.righto_profiles(user_id) on delete cascade,
  -- authored by the psychologist, shown as written
  title text not null check (length(btrim(title)) between 1 and 140),
  detail text not null default '' check (length(detail) <= 2000),
  why text not null check (length(btrim(why)) between 1 and 2000),
  mins integer not null default 10 check (mins between 1 and 180),
  needs text not null default 'Nothing' check (length(needs) <= 200),
  tags text[] not null default '{}' check (tags <@ array['quick', 'quiet']),
  suggestion jsonb check (suggestion is null or (jsonb_typeof(suggestion) = 'object' and octet_length(suggestion::text) <= 4096)),
  suggest text not null default 'coffee' check (suggest in ('coffee', 'lunch', 'wind')),
  where_opts text[] not null default '{}',
  how_opts text[] not null default '{}',
  prep_opts text[] not null default '{}',
  sent_at timestamptz not null default now(),
  -- owned by the client
  status text not null default 'new' check (status in ('new', 'planned', 'tried', 'later', 'finished')),
  kind text check (kind in ('commitment', 'goal')),
  daily boolean not null default false,
  plan jsonb check (plan is null or (jsonb_typeof(plan) = 'object' and octet_length(plan::text) <= 4096)),
  goal jsonb check (goal is null or (jsonb_typeof(goal) = 'object' and octet_length(goal::text) <= 4096)),
  later_until date,
  today_outcome text check (today_outcome in ('done', 'partial', 'missed')),
  today_date date,
  shared boolean not null default true,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
create index righto_tasks_client on public.righto_tasks(client_id, sent_at desc);
create index righto_tasks_psych on public.righto_tasks(psych_id, client_id);
create trigger righto_tasks_touch before update on public.righto_tasks for each row execute function public.righto_touch();
alter table public.righto_tasks enable row level security;

create policy tasks_client_read on public.righto_tasks for select to authenticated using (client_id = public.righto_uid());
-- A client changes only the planning fields; the clinician's words stay as written.
create policy tasks_client_update on public.righto_tasks for update to authenticated
  using (client_id = public.righto_uid())
  with check (client_id = public.righto_uid()
    and title = (select t.title from public.righto_tasks t where t.id = righto_tasks.id)
    and why = (select t.why from public.righto_tasks t where t.id = righto_tasks.id)
    and detail = (select t.detail from public.righto_tasks t where t.id = righto_tasks.id)
    and psych_id = (select t.psych_id from public.righto_tasks t where t.id = righto_tasks.id));
-- A psychologist assigns only to clients linked to them, and only while MFA is satisfied.
create policy tasks_psych_insert on public.righto_tasks for insert to authenticated
  with check (psych_id = public.righto_require_psych() and public.righto_active_link(client_id, psych_id));
create policy tasks_psych_update on public.righto_tasks for update to authenticated
  using (psych_id = public.righto_require_psych() and public.righto_active_link(client_id, psych_id))
  with check (psych_id = public.righto_uid() and client_id = (select t.client_id from public.righto_tasks t where t.id = righto_tasks.id));
-- Note: no psychologist SELECT policy on purpose. Reads go through righto_client_record() so they are logged
-- and filtered to what the client shared.
revoke all on public.righto_tasks from public, anon, authenticated;
grant select, insert, update on public.righto_tasks to authenticated;

-- ---------------------------------------------------------------------------------------------- check-ins
create table public.righto_checkins (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.righto_tasks(id) on delete cascade,
  client_id uuid not null references public.righto_profiles(user_id) on delete cascade,
  outcome text not null check (outcome in ('done', 'partial', 'missed')),
  helped text not null default '' check (length(helped) <= 1000),
  next text not null default '' check (length(next) <= 1000),
  shared boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index righto_checkins_client on public.righto_checkins(client_id, created_at desc);
create index righto_checkins_task on public.righto_checkins(task_id, created_at desc);
create trigger righto_checkins_touch before update on public.righto_checkins for each row execute function public.righto_touch();
alter table public.righto_checkins enable row level security;
create policy checkins_client_all on public.righto_checkins for all to authenticated
  using (client_id = public.righto_uid())
  with check (client_id = public.righto_uid() and exists (select 1 from public.righto_tasks t where t.id = task_id and t.client_id = public.righto_uid()));
revoke all on public.righto_checkins from public, anon, authenticated;
grant select, insert, update, delete on public.righto_checkins to authenticated;

-- ---------------------------------------------------------------------------------------------- audit log
create table public.righto_access_log (
  id bigint generated always as identity primary key,
  psych_id uuid not null references public.righto_profiles(user_id) on delete cascade,
  client_id uuid not null references public.righto_profiles(user_id) on delete cascade,
  action text not null check (action in ('view_record', 'export_record', 'assign_task', 'edit_task', 'end_link')),
  at timestamptz not null default now()
);
create index righto_access_log_client on public.righto_access_log(client_id, at desc);
alter table public.righto_access_log enable row level security;
-- Transparency both ways: a client sees who looked at their record; a psychologist sees their own log.
create policy access_log_read on public.righto_access_log for select to authenticated
  using (client_id = public.righto_uid() or psych_id = public.righto_uid());
revoke all on public.righto_access_log from public, anon, authenticated;
grant select on public.righto_access_log to authenticated;

create function public.righto_log_access(p_client uuid, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_psych uuid := public.righto_require_psych();
begin
  if not public.righto_active_link(p_client, v_psych) then raise exception 'Not linked to this client' using errcode = '42501'; end if;
  insert into public.righto_access_log(psych_id, client_id, action) values (v_psych, p_client, p_action);
end $$;
revoke all on function public.righto_log_access(uuid, text) from public, anon;

create function public.righto_log_task_write() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.righto_uid() = new.psych_id then
    insert into public.righto_access_log(psych_id, client_id, action) values (new.psych_id, new.client_id, case when tg_op = 'INSERT' then 'assign_task' else 'edit_task' end);
  end if;
  return new;
end $$;
create trigger righto_tasks_log after insert or update on public.righto_tasks for each row execute function public.righto_log_task_write();

-- ---------------------------------------------------------------------------------------------- the psychologist's one way in
-- Returns a client's record for the linked psychologist: profile basics, every task they assigned (plan and goal only
-- when the client shares them), shared check-ins only, and upcoming sessions. Every call is logged.
create function public.righto_client_record(p_client uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_psych uuid := public.righto_require_psych(); v_out jsonb;
begin
  if not public.righto_active_link(p_client, v_psych) then raise exception 'Not linked to this client' using errcode = '42501'; end if;
  insert into public.righto_access_log(psych_id, client_id, action) values (v_psych, p_client, 'view_record');
  select jsonb_build_object(
    'client', (select jsonb_build_object('id', p.user_id, 'display_name', p.display_name, 'home_prompt', coalesce((p.settings->>'homePrompt')::boolean, true)) from public.righto_profiles p where p.user_id = p_client),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'title', t.title, 'detail', t.detail, 'why', t.why, 'mins', t.mins, 'needs', t.needs, 'tags', t.tags,
        'suggestion', t.suggestion, 'sent_at', t.sent_at, 'status', t.status, 'kind', t.kind, 'daily', t.daily,
        'plan', case when t.shared then t.plan end, 'goal', case when t.shared then t.goal end, 'shared', t.shared,
        'later_until', t.later_until, 'updated_at', t.updated_at) order by t.sent_at desc)
      from public.righto_tasks t where t.client_id = p_client and t.psych_id = v_psych), '[]'::jsonb),
    'checkins', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'task_id', c.task_id, 'outcome', c.outcome, 'helped', c.helped, 'next', c.next, 'created_at', c.created_at) order by c.created_at desc)
      from public.righto_checkins c join public.righto_tasks t on t.id = c.task_id
      where c.client_id = p_client and t.psych_id = v_psych and c.shared), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'starts_at', s.starts_at, 'mode', s.mode) order by s.starts_at)
      from public.righto_sessions s where s.client_id = p_client and s.psych_id = v_psych and s.starts_at > now() - interval '1 day'), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;
revoke all on function public.righto_client_record(uuid) from public, anon;

-- The psychologist's client list: names and counts only (records, not interpretation).
create function public.righto_my_clients() returns table (client_id uuid, display_name text, linked_at timestamptz, checkins_total bigint, checkins_done bigint, last_checkin timestamptz, next_session timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.client_id, p.display_name, l.created_at,
    (select count(*) from public.righto_checkins c join public.righto_tasks t on t.id = c.task_id where c.client_id = l.client_id and t.psych_id = l.psych_id and c.shared),
    (select count(*) from public.righto_checkins c join public.righto_tasks t on t.id = c.task_id where c.client_id = l.client_id and t.psych_id = l.psych_id and c.shared and c.outcome <> 'missed'),
    (select max(c.created_at) from public.righto_checkins c join public.righto_tasks t on t.id = c.task_id where c.client_id = l.client_id and t.psych_id = l.psych_id and c.shared),
    (select min(s.starts_at) from public.righto_sessions s where s.client_id = l.client_id and s.psych_id = l.psych_id and s.starts_at > now())
  from public.righto_links l join public.righto_profiles p on p.user_id = l.client_id
  where l.psych_id = public.righto_require_psych() and l.active
  order by p.display_name
$$;
revoke all on function public.righto_my_clients() from public, anon;

-- The client's side of the link: who they are linked with.
create function public.righto_my_psychologist() returns table (link_id uuid, psych_id uuid, display_name text, title text, practice text, ahpra text, linked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.id, l.psych_id, p.display_name, coalesce(ps.title, 'Psychologist'), coalesce(ps.practice, ''), coalesce(ps.ahpra, ''), l.created_at
  from public.righto_links l join public.righto_profiles p on p.user_id = l.psych_id
  left join public.righto_psychologists ps on ps.user_id = l.psych_id
  where l.client_id = public.righto_uid() and l.active
  order by l.created_at desc limit 1
$$;
revoke all on function public.righto_my_psychologist() from public, anon;

-- ---------------------------------------------------------------------------------------------- access & erasure (APP 12, retention)
-- Everything Righto holds about the signed-in client, for "Download my data".
create function public.righto_export_me() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.righto_profiles p where p.user_id = public.righto_uid()),
    'links', coalesce((select jsonb_agg(to_jsonb(l)) from public.righto_links l where l.client_id = public.righto_uid()), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t)) from public.righto_tasks t where t.client_id = public.righto_uid()), '[]'::jsonb),
    'checkins', coalesce((select jsonb_agg(to_jsonb(c)) from public.righto_checkins c where c.client_id = public.righto_uid()), '[]'::jsonb),
    'access_log', coalesce((select jsonb_agg(to_jsonb(a)) from public.righto_access_log a where a.client_id = public.righto_uid()), '[]'::jsonb),
    'exported_at', now())
$$;
revoke all on function public.righto_export_me() from public, anon;

-- Delete my account: removes the auth user, which cascades through every table above.
create function public.righto_delete_me() returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.righto_uid();
begin
  if v_uid is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  delete from auth.users where id = v_uid;
end $$;
revoke all on function public.righto_delete_me() from public, anon;
