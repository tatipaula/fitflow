-- Atribuição de eventos in-app ao trainer logado.
-- Nullable de propósito: os eventos da landing /trial continuam anônimos (user_id null).
-- Sem FK rígida para auth.users para não arriscar quebrar o insert de tracking,
-- que nunca pode falhar e derrubar a página.
alter table page_events add column if not exists user_id uuid;

create index if not exists page_events_user_event_idx on page_events (user_id, event);
