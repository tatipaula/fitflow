create table if not exists page_events (
  id          uuid        primary key default gen_random_uuid(),
  session_id  text        not null,
  event       text        not null,
  data        jsonb       not null default '{}',
  page        text        not null default '/trial',
  referrer    text,
  ua          text,
  created_at  timestamptz not null default now()
);

alter table page_events enable row level security;

-- Qualquer visitante (anon) pode inserir — necessário para tracking sem login
create policy "page_events_insert"
  on page_events for insert
  to anon, authenticated
  with check (true);

-- Só trainers autenticados podem ler
create policy "page_events_select"
  on page_events for select
  to authenticated
  using (true);

create index page_events_session_idx on page_events (session_id);
create index page_events_event_idx   on page_events (event);
create index page_events_created_idx on page_events (created_at desc);
