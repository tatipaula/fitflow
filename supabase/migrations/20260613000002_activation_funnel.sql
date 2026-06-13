-- Funil de ativação in-app: dos trainers criados na janela de p_days, quantos
-- DISTINTOS atingiram cada marco do funil, medido pelos eventos in-app gravados
-- em page_events (user_id = trainer).
--
-- Retorna APENAS agregados (contagem de trainers distintos por etapa), zero PII —
-- seguro para o anon, mesmo padrão de validation_activation. security definer para
-- contornar a RLS de trainers/page_events.
--
-- Etapas (cada coluna = nº de trainers novos que dispararam aquele evento ao menos 1x):
--   onboarding   app_onboarding_view    (voltou/abriu o app pós-signup)
--   open_athlete create_athlete_opened  (abriu a tela de criar aluno)
--   athlete      athlete_created        (criou aluno de verdade)
--   invite       invite_generated       (gerou link de convite)
--   copied       invite_copied          (copiou o link)
--   wkt_start    workout_started        (abriu a captura de treino)
--   workout      workout_created        (criou treino)

create or replace function activation_funnel(p_days int)
returns table (
  new_trainers int,
  onboarding   int,
  open_athlete int,
  athlete      int,
  invite       int,
  copied       int,
  wkt_start    int,
  workout      int
)
language sql
security definer
set search_path = public
as $$
  with nt as (
    select id from trainers
    where created_at >= now() - (p_days || ' days')::interval
  ),
  ev as (
    select pe.user_id, pe.event
    from page_events pe
    join nt on nt.id = pe.user_id
    where pe.user_id is not null
  )
  select
    (select count(*) from nt)::int,
    (select count(distinct user_id) from ev where event = 'app_onboarding_view')::int,
    (select count(distinct user_id) from ev where event = 'create_athlete_opened')::int,
    (select count(distinct user_id) from ev where event = 'athlete_created')::int,
    (select count(distinct user_id) from ev where event = 'invite_generated')::int,
    (select count(distinct user_id) from ev where event = 'invite_copied')::int,
    (select count(distinct user_id) from ev where event = 'workout_started')::int,
    (select count(distinct user_id) from ev where event = 'workout_created')::int
$$;

grant execute on function activation_funnel(int) to anon, authenticated;
