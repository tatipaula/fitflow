# FitFlow — CLAUDE.md

## Contexto do produto
App B2B para personal trainers. O personal paga, o aluno acessa grátis via link.
Fluxo: áudio → Whisper transcreve → Claude extrai JSON → aluno executa com check-in → relatório de evolução.

## Stack
- Frontend: React + Vite + Tailwind
- Backend/Auth/DB: Supabase
- Transcrição: OpenAI Whisper API
- Parsing IA: Claude API (claude-haiku-4-5) — sempre retornar JSON válido
- Vídeos: YouTube Data API v3 — nunca hospedar vídeos próprios
- Gráficos: Recharts
- Pagamentos: Stripe

## Comandos essenciais
- npm run dev — servidor local
- npm run build — build de produção
- npm run test — testes
- supabase db push — aplicar migrations

## Padrões de código
- Sempre TypeScript, nunca JavaScript puro
- Componentes funcionais com hooks — nunca class components
- Estado global: Zustand — não usar Context API para estado compartilhado
- Chamadas à API sempre via /src/lib/api.ts — nunca fetch direto em componentes
- Variáveis de ambiente: prefixo VITE_ para frontend, sem prefixo para edge functions

## Estrutura de pastas
- /src/components — componentes reutilizáveis
- /src/pages — uma pasta por rota principal
- /src/lib — integrações externas (supabase.ts, whisper.ts, claude.ts, youtube.ts)
- /src/stores — Zustand stores
- /src/types — TypeScript types e interfaces
- /supabase/migrations — migrations versionadas

## Regras inegociáveis
- Nunca commitar chaves de API — sempre usar .env
- Toda chamada ao Claude API deve ter try/catch e fallback visível ao usuário
- Migrations do Supabase são sempre additive — nunca deletar coluna sem rollback
- Checkins e set_logs são dados críticos — nunca deletar, apenas marcar deleted
- Toda nova feature precisa de tipo TypeScript antes de implementar

## Schema do banco (resumo)
- trainers: id, email, name, stripe_customer_id, plan, created_at
- athletes: id, trainer_id, name, email, invite_token, created_at
- workouts: id, trainer_id, athlete_id, audio_url, transcript, raw_json, status, created_at
- exercises: id, workout_id, name, sets, reps, rest_seconds, notes, youtube_video_id, order_index
- sessions: id, workout_id, athlete_id, started_at, completed_at, notes
- set_logs: id, session_id, exercise_id, set_number, reps_done, weight_kg, completed_at

## Lições aprendidas (atualizar sempre)
- `onAuthStateChange` + queries ao banco causam deadlock no Supabase JS v2: o JWT ainda não está commitado quando a callback dispara. Solução: sempre usar `setTimeout(() => fn(), 0)` antes de qualquer query dentro do callback.
