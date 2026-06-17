-- Cadastros (trainers) por dia desde p_since, em horário de São Paulo, com dias
-- vazios preenchidos (zero). Exclui SEMPRE as contas internas de teste:
--   Tatiana      6bff0f76-9fdb-4a6e-be86-230ad4b4f8dd
--   Marcos       72ab42b4-224f-422b-b5e6-d254587862c7
--   João Victor  861b14c0-35a5-46bc-8fb6-1310972c6ae9
-- Retorna apenas agregados (zero PII) — seguro para o anon, mesmo padrão de
-- validation_activation. security definer para contornar a RLS de trainers.

create or replace function signups_daily(p_since date)
returns table (dia date, cadastros int)
language sql
security definer
set search_path = public
as $$
  with dias as (
    select generate_series(p_since, (now() at time zone 'America/Sao_Paulo')::date, interval '1 day')::date as dia
  ),
  por_dia as (
    select (created_at at time zone 'America/Sao_Paulo')::date as dia, count(*)::int as cadastros
    from trainers
    where created_at >= p_since
      and id not in (
        '6bff0f76-9fdb-4a6e-be86-230ad4b4f8dd',
        '72ab42b4-224f-422b-b5e6-d254587862c7',
        '861b14c0-35a5-46bc-8fb6-1310972c6ae9'
      )
    group by 1
  )
  select d.dia, coalesce(p.cadastros, 0) as cadastros
  from dias d
  left join por_dia p using (dia)
  order by d.dia
$$;

grant execute on function signups_daily(date) to anon, authenticated;
