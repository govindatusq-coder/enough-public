-- Righto · a client may add their own small thing to try when nothing has been assigned (or everything is done).
-- Own tasks have no psychologist (psych_id is null), so they never appear in righto_client_record() and are not logged
-- as assignments. The client plans and checks in on them like any other task.
alter table public.righto_tasks alter column psych_id drop not null;

create policy tasks_client_insert on public.righto_tasks for insert to authenticated
  with check (client_id = public.righto_uid() and psych_id is null);

drop policy if exists tasks_client_update on public.righto_tasks;
create policy tasks_client_update on public.righto_tasks for update to authenticated
  using (client_id = public.righto_uid())
  with check (client_id = public.righto_uid()
    and psych_id is not distinct from (select t.psych_id from public.righto_tasks t where t.id = righto_tasks.id)
    and (psych_id is null or (
      title = (select t.title from public.righto_tasks t where t.id = righto_tasks.id)
      and why = (select t.why from public.righto_tasks t where t.id = righto_tasks.id)
      and detail = (select t.detail from public.righto_tasks t where t.id = righto_tasks.id))));

create or replace function public.righto_log_task_write() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.psych_id is not null and public.righto_uid() = new.psych_id then
    insert into public.righto_access_log(psych_id, client_id, action) values (new.psych_id, new.client_id, case when tg_op = 'INSERT' then 'assign_task' else 'edit_task' end);
  end if;
  return new;
end $$;
