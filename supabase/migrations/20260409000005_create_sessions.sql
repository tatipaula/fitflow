-- Migration: create sessions table
-- A session represents one execution of a workout by an athlete.

create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references public.workouts(id) on delete cascade,
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  notes        text
);

create index sessions_workout_id_idx  on public.sessions(workout_id);
create index sessions_athlete_id_idx  on public.sessions(athlete_id);

-- RLS
alter table public.sessions enable row level security;

-- Athlete can manage their own sessions
create policy "athlete: full access to own sessions"
  on public.sessions for all
  using (auth.uid() = athlete_id);

-- Trainer can read sessions of their athletes
create policy "trainer: select sessions of own athletes"
  on public.sessions for select
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id
        and w.trainer_id = auth.uid()
    )
  );
