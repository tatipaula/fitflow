-- Add name column to workouts for multi-workout-per-athlete support
alter table public.workouts add column name text;
