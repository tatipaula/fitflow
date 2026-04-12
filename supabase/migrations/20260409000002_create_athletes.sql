-- Migration: create athletes table
-- Athletes are linked to a trainer and access via invite_token (no paid account)

create table public.athletes (
  id           uuid primary key default gen_random_uuid(),
  trainer_id   uuid not null references public.trainers(id) on delete cascade,
  name         text not null,
  email        text not null,
  invite_token text not null unique default encode(gen_random_bytes(24), 'base64url'),
  created_at   timestamptz not null default now()
);

create index athletes_trainer_id_idx on public.athletes(trainer_id);
create index athletes_invite_token_idx on public.athletes(invite_token);

-- RLS
alter table public.athletes enable row level security;

-- Trainer can manage their own athletes
create policy "trainer: full access to own athletes"
  on public.athletes for all
  using (
    auth.uid() = trainer_id
  );

-- Athlete can read their own row (authenticated via invite token flow)
create policy "athlete: select own row"
  on public.athletes for select
  using (
    auth.uid() = id
  );

-- Public read by invite_token (needed for the invite link flow before auth)
create policy "public: select athlete by invite_token"
  on public.athletes for select
  using (true);
