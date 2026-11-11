-- Background job visibility and a run lock. One row per run of a scheduled job. The unique (job, run_key) means two runs started in the
-- same window cannot both proceed (the second sees the row and exits), and the table answers "did the reminder job run, and did it fail?".
-- Service role only: no policy and no grants for signed-in users. Holds counts only, never anything about a family.
-- Rollback: drop table if exists public.bear_job_runs;
create table if not exists public.bear_job_runs (
 job text not null,
 run_key text not null,
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 status text not null default 'running' check (status in ('running','ok','failed','skipped')),
 delivered integer not null default 0,
 failed integer not null default 0,
 note text,
 primary key (job,run_key)
);
alter table public.bear_job_runs enable row level security;
revoke all on public.bear_job_runs from anon,authenticated;
