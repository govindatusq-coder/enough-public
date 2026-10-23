-- Load Bear: PARA-based life-management schema (bills vertical slice first).
-- Every table stores the full typed entity in body (including AI provenance per field)
-- plus indexed columns used for filtering. Owner-only row-level security throughout.
-- Apply once to the Supabase project; see docs/load-bear/06-external-configuration.md.

create table public.bear_profiles (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 onboarding_complete boolean not null default false,
 day_mode text,
 revision integer not null default 1,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id)
);
alter table public.bear_profiles enable row level security;
create policy own_rows on public.bear_profiles to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_profiles to authenticated;
revoke all on public.bear_profiles from anon;
create index bear_profiles_owner on public.bear_profiles(user_id);

create table public.bear_areas (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 key text not null,
 archived boolean not null default false,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_areas enable row level security;
create policy own_rows on public.bear_areas to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_areas to authenticated;
revoke all on public.bear_areas from anon;
create index bear_areas_owner on public.bear_areas(user_id);

create table public.bear_people (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null,
 archived boolean not null default false,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_people enable row level security;
create policy own_rows on public.bear_people to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_people to authenticated;
revoke all on public.bear_people from anon;
create index bear_people_owner on public.bear_people(user_id);

create table public.bear_captures (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null,
 method text not null,
 is_demo boolean not null default false,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_captures enable row level security;
create policy own_rows on public.bear_captures to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_captures to authenticated;
revoke all on public.bear_captures from anon;
create index bear_captures_owner on public.bear_captures(user_id,status);

create table public.bear_source_documents (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 capture_id uuid not null,
 object_key text not null,
 mime text not null,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_source_documents enable row level security;
create policy own_rows on public.bear_source_documents to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_source_documents to authenticated;
revoke all on public.bear_source_documents from anon;
create index bear_source_documents_owner on public.bear_source_documents(user_id);

create table public.bear_extractions (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 capture_id uuid not null,
 kind text not null,
 status text not null,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_extractions enable row level security;
create policy own_rows on public.bear_extractions to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_extractions to authenticated;
revoke all on public.bear_extractions from anon;
create index bear_extractions_owner on public.bear_extractions(user_id,capture_id);

create table public.bear_ai_inferences (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 capture_id uuid,
 service text not null,
 provider text not null,
 model text not null,
 ok boolean not null default true,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_ai_inferences enable row level security;
create policy own_rows on public.bear_ai_inferences to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_ai_inferences to authenticated;
revoke all on public.bear_ai_inferences from anon;
create index bear_ai_inferences_owner on public.bear_ai_inferences(user_id);

create table public.bear_user_corrections (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 extraction_id uuid not null,
 field text not null,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_user_corrections enable row level security;
create policy own_rows on public.bear_user_corrections to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_user_corrections to authenticated;
revoke all on public.bear_user_corrections from anon;
create index bear_user_corrections_owner on public.bear_user_corrections(user_id);

create table public.bear_projects (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 area_key text not null,
 status text not null,
 due_at date,
 bill_id uuid,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_projects enable row level security;
create policy own_rows on public.bear_projects to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_projects to authenticated;
revoke all on public.bear_projects from anon;
create index bear_projects_owner on public.bear_projects(user_id,status);

create table public.bear_tasks (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid not null,
 status text not null,
 due_at date,
 kind text not null,
 is_demo boolean not null default false,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_tasks enable row level security;
create policy own_rows on public.bear_tasks to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_tasks to authenticated;
revoke all on public.bear_tasks from anon;
create index bear_tasks_owner on public.bear_tasks(user_id,status,due_at);
create index bear_tasks_status on public.bear_tasks(user_id,status);
create index bear_tasks_due_at on public.bear_tasks(user_id,due_at);

create table public.bear_task_dependencies (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid not null,
 depends_on_task_id uuid not null,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_task_dependencies enable row level security;
create policy own_rows on public.bear_task_dependencies to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_task_dependencies to authenticated;
revoke all on public.bear_task_dependencies from anon;
create index bear_task_dependencies_owner on public.bear_task_dependencies(user_id);

create table public.bear_bills (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid not null,
 project_id uuid not null,
 status text not null,
 due_at date,
 biller_key text,
 amount_cents integer not null default 0,
 is_demo boolean not null default false,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_bills enable row level security;
create policy own_rows on public.bear_bills to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_bills to authenticated;
revoke all on public.bear_bills from anon;
create index bear_bills_owner on public.bear_bills(user_id,status,due_at,biller_key);
create index bear_bills_status on public.bear_bills(user_id,status);
create index bear_bills_due_at on public.bear_bills(user_id,due_at);
create index bear_bills_biller_key on public.bear_bills(user_id,biller_key);

create table public.bear_recurring_expectations (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 biller_key text not null,
 status text not null,
 expected_from date not null,
 expected_to date not null,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_recurring_expectations enable row level security;
create policy own_rows on public.bear_recurring_expectations to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_recurring_expectations to authenticated;
revoke all on public.bear_recurring_expectations from anon;
create index bear_recurring_expectations_owner on public.bear_recurring_expectations(user_id,status);

create table public.bear_reminders (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid not null,
 bill_id uuid,
 status text not null,
 scheduled_for timestamptz not null,
 kind text not null,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_reminders enable row level security;
create policy own_rows on public.bear_reminders to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_reminders to authenticated;
revoke all on public.bear_reminders from anon;
create index bear_reminders_owner on public.bear_reminders(user_id,status,scheduled_for);
create index bear_reminders_status on public.bear_reminders(user_id,status);
create index bear_reminders_scheduled_for on public.bear_reminders(user_id,scheduled_for);

create table public.bear_reminder_interactions (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 reminder_id uuid not null,
 action text not null,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_reminder_interactions enable row level security;
create policy own_rows on public.bear_reminder_interactions to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_reminder_interactions to authenticated;
revoke all on public.bear_reminder_interactions from anon;
create index bear_reminder_interactions_owner on public.bear_reminder_interactions(user_id);

create table public.bear_suggestions (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null,
 kind text not null,
 dedupe_key text not null,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_suggestions enable row level security;
create policy own_rows on public.bear_suggestions to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_suggestions to authenticated;
revoke all on public.bear_suggestions from anon;
create index bear_suggestions_owner on public.bear_suggestions(user_id,status,dedupe_key);
create index bear_suggestions_status on public.bear_suggestions(user_id,status);
create index bear_suggestions_dedupe_key on public.bear_suggestions(user_id,dedupe_key);

create table public.bear_completions (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid not null,
 bill_id uuid,
 completed_at timestamptz not null,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_completions enable row level security;
create policy own_rows on public.bear_completions to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_completions to authenticated;
revoke all on public.bear_completions from anon;
create index bear_completions_owner on public.bear_completions(user_id,completed_at);

create table public.bear_wins (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 completion_id uuid not null,
 category text not null,
 bill_id uuid,
 is_demo boolean not null default false,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_wins enable row level security;
create policy own_rows on public.bear_wins to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_wins to authenticated;
revoke all on public.bear_wins from anon;
create index bear_wins_owner on public.bear_wins(user_id,created_at);

create table public.bear_value_ledger (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null,
 reason text not null,
 amount_cents integer,
 minutes integer,
 occurred_at timestamptz not null,
 defensible boolean not null default false,
 is_demo boolean not null default false,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_value_ledger enable row level security;
create policy own_rows on public.bear_value_ledger to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_value_ledger to authenticated;
revoke all on public.bear_value_ledger from anon;
create index bear_value_ledger_owner on public.bear_value_ledger(user_id,kind,occurred_at);
create index bear_value_ledger_kind on public.bear_value_ledger(user_id,kind);
create index bear_value_ledger_occurred_at on public.bear_value_ledger(user_id,occurred_at);

create table public.bear_behaviour_events (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 type text not null,
 at timestamptz not null,
 hour_local integer not null,
 weekday text not null,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_behaviour_events enable row level security;
create policy own_rows on public.bear_behaviour_events to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_behaviour_events to authenticated;
revoke all on public.bear_behaviour_events from anon;
create index bear_behaviour_events_owner on public.bear_behaviour_events(user_id,type,at);
create index bear_behaviour_events_type on public.bear_behaviour_events(user_id,type);
create index bear_behaviour_events_at on public.bear_behaviour_events(user_id,at);

create table public.bear_push_subscriptions (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique,
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=262144),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bear_push_subscriptions enable row level security;
create policy own_rows on public.bear_push_subscriptions to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,update,delete on public.bear_push_subscriptions to authenticated;
revoke all on public.bear_push_subscriptions from anon;
create index bear_push_subscriptions_owner on public.bear_push_subscriptions(user_id);

-- Private bucket for original bills (images and PDFs). 10 MB per file, owner folder only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('bear-documents','bear-documents',false,10485760,array['image/jpeg','image/png','image/webp','image/heic','application/pdf']);
create policy bear_documents_read on storage.objects for select to authenticated
 using(bucket_id='bear-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy bear_documents_write on storage.objects for insert to authenticated
 with check(bucket_id='bear-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy bear_documents_delete on storage.objects for delete to authenticated
 using(bucket_id='bear-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
