-- Aluno de teste (demo) para ativação de treinadores.
-- O treinador novo pode criar um aluno demo já populado para explorar o produto
-- antes de cadastrar um aluno real. O demo NÃO pode contar nas métricas de
-- ativação da validação, senão infla justamente o KPI que medimos.

alter table athletes add column if not exists is_demo boolean not null default false;

-- Recria validation_activation excluindo alunos demo dos agregados.
-- Mesma assinatura/segurança da 20260611000003_validation_activation.sql.
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
       from athletes a join nt on a.trainer_id = nt.id
       where not a.is_demo)::int,
    (select count(*)
       from athletes a join nt on a.trainer_id = nt.id
       where not a.is_demo)::int
$$;

grant execute on function validation_activation(int) to anon, authenticated;
