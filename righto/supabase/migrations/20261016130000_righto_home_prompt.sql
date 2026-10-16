-- Righto · the psychologist's "Ask ‘What feels doable?’ on Home" switch lives on the link, and the client reads it.
alter table public.righto_links add column if not exists home_prompt boolean not null default true;

create or replace function public.righto_set_home_prompt(p_client uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_psych uuid := public.righto_require_psych();
begin
  update public.righto_links set home_prompt = p_on where client_id = p_client and psych_id = v_psych and active;
  if not found then raise exception 'Not linked to this client' using errcode = '42501'; end if;
end $$;
revoke all on function public.righto_set_home_prompt(uuid, boolean) from public, anon;

drop function if exists public.righto_my_psychologist();
create function public.righto_my_psychologist() returns table (link_id uuid, psych_id uuid, display_name text, title text, practice text, ahpra text, linked_at timestamptz, home_prompt boolean)
language sql stable security definer set search_path = '' as $$
  select l.id, l.psych_id, p.display_name, coalesce(ps.title, 'Psychologist'), coalesce(ps.practice, ''), coalesce(ps.ahpra, ''), l.created_at, l.home_prompt
  from public.righto_links l join public.righto_profiles p on p.user_id = l.psych_id
  left join public.righto_psychologists ps on ps.user_id = l.psych_id
  where l.client_id = public.righto_uid() and l.active
  order by l.created_at desc limit 1
$$;
revoke all on function public.righto_my_psychologist() from public, anon;

create or replace function public.righto_client_record(p_client uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_psych uuid := public.righto_require_psych(); v_out jsonb;
begin
  if not public.righto_active_link(p_client, v_psych) then raise exception 'Not linked to this client' using errcode = '42501'; end if;
  insert into public.righto_access_log(psych_id, client_id, action) values (v_psych, p_client, 'view_record');
  select jsonb_build_object(
    'client', (select jsonb_build_object('id', p.user_id, 'display_name', p.display_name, 'home_prompt', l.home_prompt, 'link_id', l.id, 'linked_at', l.created_at)
               from public.righto_profiles p join public.righto_links l on l.client_id = p.user_id and l.psych_id = v_psych and l.active
               where p.user_id = p_client),
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
