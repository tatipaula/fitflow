-- Migration: create trainers table
-- Trainers are the paying users (personal trainers)

create table public.trainers (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null unique,
  name               text not null,
  stripe_customer_id text,
  plan               text not null default 'free' check (plan in ('free', 'pro')),
  created_at         timestamptz not null default now()
);

-- RLS
alter table public.trainers enable row level security;

-- A trainer can only read/update their own row
create policy "trainer: select own row"
  on public.trainers for select
  using (auth.uid() = id);

create policy "trainer: update own row"
  on public.trainers for update
  using (auth.uid() = id);

-- Insert is handled by the auth trigger below
create policy "trainer: insert own row"
  on public.trainers for insert
  with check (auth.uid() = id);

-- Auto-create trainer row when a new user signs up via Supabase Auth
create or replace function public.handle_new_trainer()
returns trigger language plpgsql security definer as $$
begin
  insert into public.trainers (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_trainer();
