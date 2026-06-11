-- KPI de ativação da validação: dos trainers criados na janela de p_days,
-- quantos cadastraram pelo menos 1 aluno, e quantos alunos no total.
-- Retorna APENAS agregados (zero PII) — seguro para o anon, mesmo padrão de
-- count_trainers_in_window. Contorna a RLS de trainers/athletes via security definer.

create or replace function validation_activation(p_days int)
returns table (new_trainers int, activated_trainers int, athletes_total int)
language sql
security definer
set search_path = public
as $$
  with nt as (
    select id from trainers
    where created_at >= now() - (p_days || ' days')::interval
  )
  select
    (select count(*) from nt)::int,
    (select count(distinct a.trainer_id)
       from athletes a join nt on a.trainer_id = nt.id)::int,
    (select count(*)
       from athletes a join nt on a.trainer_id = nt.id)::int
$$;

grant execute on function validation_activation(int) to anon, authenticated;
