-- Dos cadastros (trainers) desde p_since, quantos ativaram aluno REAL, quantos
-- ativaram só aluno de TESTE (demo) e quantos ativaram qualquer um. Exclui SEMPRE
-- as contas internas de teste (Tatiana / Marcos / João Victor). Apenas agregados,
-- zero PII, security definer — mesmo padrão de validation_activation.

create or replace function signups_activation(p_since date)
returns table (
  total_cadastros      int,
  ativaram_aluno_real  int,
  ativaram_aluno_teste int,
  ativaram_qualquer    int
)
language sql
security definer
set search_path = public
as $$
  with reais as (
    select id from trainers
    where created_at >= p_since
      and id not in (
        '6bff0f76-9fdb-4a6e-be86-230ad4b4f8dd',
        '72ab42b4-224f-422b-b5e6-d254587862c7',
        '861b14c0-35a5-46bc-8fb6-1310972c6ae9'
      )
  )
  select
    (select count(*) from reais)::int,
    (select count(distinct a.trainer_id) from athletes a join reais r on r.id = a.trainer_id where not a.is_demo)::int,
    (select count(distinct a.trainer_id) from athletes a join reais r on r.id = a.trainer_id where a.is_demo)::int,
    (select count(distinct a.trainer_id) from athletes a join reais r on r.id = a.trainer_id)::int
$$;

grant execute on function signups_activation(date) to anon, authenticated;
