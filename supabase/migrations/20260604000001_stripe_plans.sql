-- Migration: Stripe plans + trial + grandfathering
-- Existing trainers → plan='pro' permanently (grandfathered)
-- New signups → plan='free' + trial_ends_at = now() + 15 days

alter table public.trainers
  add column if not exists trial_ends_at      timestamptz,
  add column if not exists stripe_subscription_id text;

-- Grandfather all existing trainers: they keep full access forever
update public.trainers set plan = 'pro' where plan = 'free';

-- Update trigger so NEW signups get trial
create or replace function public.handle_new_trainer()
returns trigger language plpgsql security definer as $$
begin
  insert into public.trainers (id, email, name, plan, trial_ends_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'free',
    now() + interval '15 days'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
