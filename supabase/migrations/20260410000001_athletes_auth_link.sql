-- Migration: vincula atletas a contas Supabase Auth
-- Adiciona auth_user_id para mapear athletes.id → auth.users.id sem alterar PK

alter table public.athletes add column auth_user_id uuid unique;
create index athletes_auth_user_id_idx on public.athletes(auth_user_id);

-- Atualiza política de leitura do atleta para usar auth_user_id
drop policy "athlete: select own row" on public.athletes;
create policy "athlete: select own row"
  on public.athletes for select
  using (auth.uid() = auth_user_id);

-- RPC security definer: vincula conta Auth ao registro de atleta via invite_token
-- Só funciona se auth_user_id ainda estiver nulo (evita hijacking)
create or replace function public.link_athlete_account(p_invite_token text)
returns boolean
language plpgsql security definer as $$
begin
  update public.athletes
  set auth_user_id = auth.uid()
  where invite_token = p_invite_token
    and auth_user_id is null;
  return found;
end;
$$;

-- Atualiza trigger para não criar linha em trainers quando role = 'athlete'
create or replace function public.handle_new_trainer()
returns trigger language plpgsql security definer as $$
begin
  if new.raw_user_meta_data->>'role' = 'athlete' then
    return new;
  end if;
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
