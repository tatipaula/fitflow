-- Investimento em anúncios (Meta Ads) — entrada MANUAL.
-- A /trial/stats é protegida por senha client-side (VITE_STATS_PW) e usa o
-- cliente anônimo do Supabase — nunca há login de trainer. Mesmo modelo de
-- segurança do page_events: dados de marketing sem PII sensível.
-- Gasto é gravado por dia (BRL); a página soma por janela (7/14/30d).

create table if not exists ad_spend (
  spend_date  date          primary key,
  amount_brl  numeric(10,2) not null check (amount_brl >= 0),
  source      text          not null default 'meta',
  updated_at  timestamptz   not null default now()
);

alter table ad_spend enable row level security;

create policy "ad_spend_select"
  on ad_spend for select
  to anon, authenticated
  using (true);

create policy "ad_spend_insert"
  on ad_spend for insert
  to anon, authenticated
  with check (true);

create policy "ad_spend_update"
  on ad_spend for update
  to anon, authenticated
  using (true)
  with check (true);

-- Custo por cadastro precisa do nº de trainers criados na janela, mas a tabela
-- trainers tem RLS que bloqueia o anon. Esta função security definer expõe
-- apenas a CONTAGEM (zero PII) para o painel de validação.
create or replace function count_trainers_in_window(p_days int)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int
  from trainers
  where created_at >= now() - (p_days || ' days')::interval
$$;

grant execute on function count_trainers_in_window(int) to anon, authenticated;
