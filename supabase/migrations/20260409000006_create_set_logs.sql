-- Migration: create set_logs table
-- CRITICAL: set_logs are immutable — never hard delete, only soft-delete via deleted flag.

create table public.set_logs (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions(id) on delete cascade,
  exercise_id  uuid not null references public.exercises(id) on delete cascade,
  set_number   integer not null check (set_number > 0),
  reps_done    integer not null check (reps_done >= 0),
  weight_kg    numeric(6, 2) check (weight_kg >= 0),
  completed_at timestamptz not null default now(),
  deleted      boolean not null default false
);

create index set_logs_session_id_idx  on public.set_logs(session_id);
create index set_logs_exercise_id_idx on public.set_logs(exercise_id);
-- Partial index to efficiently query non-deleted logs (the common case)
create index set_logs_active_idx on public.set_logs(session_id) where deleted = false;

-- RLS
alter table public.set_logs enable row level security;

-- Athlete can insert and read their own logs (via session ownership)
create policy "athlete: insert own set_logs"
  on public.set_logs for insert
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_id
        and s.athlete_id = auth.uid()
    )
  );

create policy "athlete: select own set_logs"
  on public.set_logs for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id
        and s.athlete_id = auth.uid()
    )
  );

-- Athlete can soft-delete (update deleted flag only) — no hard delete allowed
create policy "athlete: soft-delete own set_logs"
  on public.set_logs for update
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id
        and s.athlete_id = auth.uid()
    )
  )
  with check (deleted = true);  -- only allowed update is marking deleted

-- Trainer can read logs of their athletes for progress reports
create policy "trainer: select set_logs of own athletes"
  on public.set_logs for select
  using (
    exists (
      select 1
        from public.sessions s
        join public.workouts w on w.id = s.workout_id
       where s.id = session_id
         and w.trainer_id = auth.uid()
    )
  );
