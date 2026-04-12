-- Migration: create exercises table
-- Exercises belong to a workout and are extracted by Claude from the transcript.

create table public.exercises (
  id               uuid primary key default gen_random_uuid(),
  workout_id       uuid not null references public.workouts(id) on delete cascade,
  name             text not null,
  sets             integer not null check (sets > 0),
  reps             integer not null check (reps > 0),
  rest_seconds     integer not null default 60 check (rest_seconds >= 0),
  notes            text,
  youtube_video_id text,
  order_index      integer not null default 0,
  created_at       timestamptz not null default now()
);

create index exercises_workout_id_idx on public.exercises(workout_id);

-- RLS
alter table public.exercises enable row level security;

-- Trainer can manage exercises via workout ownership
create policy "trainer: full access via workout"
  on public.exercises for all
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id
        and w.trainer_id = auth.uid()
    )
  );

-- Athlete can read exercises of their workouts
create policy "athlete: select via workout"
  on public.exercises for select
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id
        and w.athlete_id = auth.uid()
    )
  );
