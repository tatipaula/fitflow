create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid references trainers(id) on delete cascade not null,
  athlete_id uuid references athletes(id) on delete cascade not null,
  icon text not null,
  title text not null,
  created_at timestamptz default now()
);

alter table badges enable row level security;

create policy "Trainer manage own badges" on badges
  for all using (
    trainer_id in (select id from trainers where id = auth.uid())
  );

create policy "Athlete read own badges" on badges
  for select using (
    athlete_id in (select id from athletes where auth_user_id = auth.uid())
  );
