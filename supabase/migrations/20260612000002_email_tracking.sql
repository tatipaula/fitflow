-- Tracking de campanhas de email (Resend). A /trial/stats usa cliente anônimo,
-- então NÃO expomos a tabela (tem email = PII) — só um RPC agregado security definer,
-- mesmo padrão de validation_activation.

create table if not exists email_events (
  id uuid primary key default gen_random_uuid(),
  resend_id text,
  recipient text not null,
  type text not null,            -- sent | delivered | opened | clicked | bounced | complained
  campaign text,                 -- ex: 'demo-announce'
  created_at timestamptz not null default now(),
  unique (resend_id, type)
);

create index if not exists email_events_campaign_idx on email_events (campaign, type);

alter table email_events enable row level security;
-- Sem policy de select para anon/authenticated: leitura só via RPC agregado abaixo.
-- O webhook escreve com a service role key (bypassa RLS).

-- Funil agregado de uma campanha (zero PII): enviados, abertos, clicaram e quantos
-- desses destinatários já criaram um aluno de teste (is_demo). Granted ao anon.
create or replace function campaign_funnel(p_campaign text)
returns table (sent int, opened int, clicked int, created_demo int)
language sql
security definer
set search_path = public
as $$
  with sends as (
    select distinct recipient from email_events where campaign = p_campaign and type = 'sent'
  )
  select
    (select count(*) from sends)::int,
    (select count(distinct recipient) from email_events
       where campaign = p_campaign and type = 'opened'
       and recipient in (select recipient from sends))::int,
    (select count(distinct recipient) from email_events
       where campaign = p_campaign and type = 'clicked'
       and recipient in (select recipient from sends))::int,
    (select count(distinct s.recipient)
       from sends s
       join trainers t on lower(t.email) = lower(s.recipient)
       join athletes a on a.trainer_id = t.id and a.is_demo)::int
$$;

grant execute on function campaign_funnel(text) to anon, authenticated;
