-- Research study survey answers (opt-in). Additive. Owner-only, like every bear_* table. Answers are numbers
-- only (no free text). The researcher export runs with the service role and pseudonymises participants.
-- Rollback: drop table if exists public.bear_study_responses;
create table if not exists public.bear_study_responses (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 phase text not null check (phase in ('baseline','weekly','end')),
 instrument text not null check (instrument in ('tlx','sus','weekly','context')),
 week integer not null check (week between 0 and 6),
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=8192),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists bear_study_responses_user on public.bear_study_responses(user_id,phase,week);
alter table public.bear_study_responses enable row level security;
create policy own_rows on public.bear_study_responses to authenticated
 using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
grant select,insert,delete on public.bear_study_responses to authenticated;
revoke update on public.bear_study_responses from authenticated;
revoke all on public.bear_study_responses from anon;
