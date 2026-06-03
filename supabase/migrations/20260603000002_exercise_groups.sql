alter table exercises
  add column if not exists group_id integer,
  add column if not exists method  text check (method in ('biset', 'triset', 'circuit', 'dropset'));

create index if not exists exercises_workout_group on exercises (workout_id, group_id);
