-- Migration: pg_cron jobs for offer-plans (D-3 trial warning) and recovery (abandoned checkout)
-- pg_cron e pg_net (net schema) já ativos no projeto

alter table public.trainers
  add column if not exists recovery_email_sent boolean not null default false;

-- offer-plans: diariamente às 9h BRT (12:00 UTC) — trainers com trial expirando em 3 dias
select cron.schedule(
  'offer-plans-daily',
  '0 12 * * *',
  $$
  select net.http_post(
    url     := 'https://yxrmiuldmywsgrcpiuos.supabase.co/functions/v1/offer-plans',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4cm1pdWxkbXl3c2dyY3BpdW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDAxNDAsImV4cCI6MjA5MTMxNjE0MH0.ZoM3i4UOG_EvoFNaa3cUpyWvA-J3BelSxrS2rrleEoM"}'::jsonb,
    body    := '{}'::jsonb
  ) as request_id;
  $$
);

-- recovery: diariamente às 10h BRT (13:00 UTC) — checkouts abandonados (envia uma vez por trainer)
select cron.schedule(
  'recovery-daily',
  '0 13 * * *',
  $$
  select net.http_post(
    url     := 'https://yxrmiuldmywsgrcpiuos.supabase.co/functions/v1/recovery',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4cm1pdWxkbXl3c2dyY3BpdW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDAxNDAsImV4cCI6MjA5MTMxNjE0MH0.ZoM3i4UOG_EvoFNaa3cUpyWvA-J3BelSxrS2rrleEoM"}'::jsonb,
    body    := '{}'::jsonb
  ) as request_id;
  $$
);
