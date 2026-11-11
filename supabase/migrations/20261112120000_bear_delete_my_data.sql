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
