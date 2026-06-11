-- A página /trial/stats é protegida por senha client-side (VITE_STATS_PW) e usa
-- o cliente anônimo do Supabase — nunca há login de trainer. A policy de SELECT
-- original era `to authenticated`, então o anon recebia [] e a página zerava tudo.
-- Liberamos SELECT para anon (dados de analytics da landing, sem PII sensível).

drop policy if exists "page_events_select" on page_events;

create policy "page_events_select"
  on page_events for select
  to anon, authenticated
  using (true);
