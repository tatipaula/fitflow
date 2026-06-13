-- Fix: re-adiciona a guarda de role='athlete' no trigger handle_new_trainer.
--
-- Regressão: a guarda foi introduzida em 20260410000001 mas REMOVIDA sem querer em
-- 20260604000001_stripe_plans.sql, quando a função foi reescrita para incluir o trial.
-- Desde 04/06 todo atleta que aceita um convite (signUp com role='athlete') ganha
-- também uma linha fantasma em `trainers` (padrão "conta órfã"), inflando a contagem
-- de cadastros de personal.
--
-- Esta versão combina as DUAS coisas: a guarda de athlete + o trial dos novos personais.
-- Seguro: signup de personal (LoginPage) não envia role -> cria trainer normalmente;
-- signup de atleta (Convite/Invite) envia role='athlete' -> não cria trainer.
-- Afeta apenas inserts NOVOS em auth.users; contas existentes não mudam.

create or replace function public.handle_new_trainer()
returns trigger language plpgsql security definer as $$
begin
  if new.raw_user_meta_data->>'role' = 'athlete' then
    return new;
  end if;
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
