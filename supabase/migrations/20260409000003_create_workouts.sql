-- Migration: create workouts table
-- A workout is created by the trainer, linked to one athlete.
-- It goes through a status pipeline: pending → transcribing → parsing → ready | error

create table public.workouts (
  id         uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  audio_url  text,
  transcript text,
  raw_json   jsonb,
  status     text not null default 'pending'
               check (status in ('pending', 'transcribing', 'parsing', 'ready', 'error')),
  created_at timestamptz not null default now()
);

create index workouts_trainer_id_idx  on public.workouts(trainer_id);
create index workouts_athlete_id_idx  on public.workouts(athlete_id);
create index workouts_status_idx      on public.workouts(status);

-- RLS
alter table public.workouts enable row level security;

-- Trainer can manage their own workouts
create policy "trainer: full access to own workouts"
  on public.workouts for all
  using (auth.uid() = trainer_id);

-- Athlete can read workouts assigned to them
create policy "athlete: select own workouts"
  on public.workouts for select
  using (auth.uid() = athlete_id);
