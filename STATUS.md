# FitFlow — Status do Projeto

**Última atualização:** 12/04/2026 (sessão 4)

---

## Concluído

### Infraestrutura base
- [x] Projeto Vite + React + TypeScript + Tailwind configurado e buildando
- [x] `.env.example` com todas as variáveis necessárias documentadas
- [x] `.env` configurado com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- [x] Supabase CLI instalada (`supabase.exe` na raiz do projeto)
- [x] Projeto vinculado ao Supabase (`supabase link`)

### Tipos TypeScript (`src/types/index.ts`)
- [x] Enums: `WorkoutStatus`, `UserPlan`, `UserRole`
- [x] Interfaces: `Trainer`, `Athlete`, `Workout`, `Exercise`, `Session`, `SetLog`
- [x] Shapes de input: `CreateWorkoutInput`, `LogSetInput`
- [x] `AuthState` com campo `loading: boolean`

### Banco de dados — Migrations aplicadas no Supabase
- [x] `trainers` — com trigger de auto-criação ao signup (exceto para atletas via `role` em metadata)
- [x] `athletes` — `invite_token` gerado automaticamente
- [x] `workouts`, `exercises`, `sessions`, `set_logs` — com RLS e soft-delete
- [x] `athletes.auth_user_id` — coluna para vincular atleta à conta Auth sem alterar PK
- [x] RPC `link_athlete_account(p_invoke_token)` — vincula auth.uid() ao atleta via invite token (security definer)
- [x] Trigger atualizado para não criar linha em `trainers` quando `role = 'athlete'` no metadata
- [x] `invite_token` default corrigido: `encode(..., 'base64url')` → `replace(gen_random_uuid()::text, '-', '')` (PostgreSQL não suporta base64url nativamente)
- [x] RLS de `workouts`, `exercises`, `sessions`, `set_logs` corrigido: políticas de atleta agora resolvem `athletes.id` via join em vez de comparar diretamente com `auth.uid()`

### Edge Functions (Supabase)
- [x] `transcribe-audio` — recebe `audio_url`, busca áudio do Storage, chama Whisper API, retorna `transcript`
- [x] `parse-workout` — recebe `transcript`, chama Claude (claude-haiku-4-5-20251001), retorna array de exercícios em JSON
- [x] Secrets configurados: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- [x] Bucket `audio` criado no Supabase Storage (public)
- [⚠️] Processamento de áudio falha em produção — causa ainda não identificada (ver seção Bugs)

### Integrações externas (`src/lib/`)
- [x] `supabase.ts` — cliente Supabase
- [x] `whisper.ts` — upload para Storage + invoke Edge Function
- [x] `claude.ts` — invoke Edge Function `parse-workout`
- [x] `youtube.ts` — busca de vídeos via YouTube Data API v3
- [x] `api.ts` — camada central com todas as operações CRUD + `createAthlete`, `getAthleteByAuthId`, `linkAthleteAccount`

### Estado global (`src/stores/authStore.ts`)
- [x] Zustand store com `role`, `trainer`, `athlete`, `loading`
- [x] `initAuth(userId)` — verifica atleta (por `auth_user_id`) primeiro, depois trainer
- [x] `clearAuth` com `loading: false`

### Roteamento (`src/App.tsx`)
- [x] Rotas: `/login`, `/invite/:token`, `/trainer`, `/athlete`
- [x] `onAuthStateChange` com `setTimeout` para evitar deadlock de queries dentro do callback
- [x] Token de convite pendente (`pending_invite_token` no localStorage) vinculado após confirmação de email

### Autenticação
- [x] `LoginPage.tsx` — login e cadastro com email/senha para trainers
- [x] Persistência de sessão via `onAuthStateChange`
- [x] Redirecionamento por role após login

### Painel do Personal (`/trainer`) — `DashboardPage.tsx`
- [x] Header com nome do trainer e botão de logout
- [x] Aba Atletas: listar atletas, adicionar atleta, copiar link de convite
- [x] Aba Treinos: gravar áudio (MediaRecorder) ou upload de arquivo, selecionar atleta, processar treino
- [x] Status do treino em tempo real (pending → transcribing → parsing → ready | error)
- [x] Expandir treino para ver exercícios extraídos

### Página de Convite (`/invite/:token`) — `InvitePage.tsx`
- [x] Busca atleta pelo invite token (política pública de RLS)
- [x] Cadastro com email/senha (sinaliza `role: 'athlete'` no metadata para não criar linha em trainers)
- [x] Login para atletas que já têm conta
- [x] Vinculação automática de `auth_user_id` após autenticação

### Componentes
- [x] `LoadingSpinner.tsx`

---

## Bugs conhecidos

- [ ] **Processamento de áudio falha** — `transcribe-audio` Edge Function retorna erro mesmo com secrets configurados. Investigar: (1) políticas do bucket `audio` no Storage, (2) logs em Supabase Dashboard → Edge Functions → Logs, (3) confirmar deploy das funções com `npx supabase functions deploy`

---

## Pendente

### Deploy
- [ ] Criar repositório git e push para GitHub
- [ ] Deploy no Vercel (vercel.json já criado, variáveis VITE_ a configurar no painel)

### Tela do Atleta (`/athlete`) — `WorkoutPage.tsx`
- [x] Exibir treino mais recente atribuído ao atleta
- [x] Iniciar sessão de treino
- [x] Log de séries (reps feitas + peso)
- [x] Concluir sessão
- [ ] Timer de descanso entre séries
- [ ] Embed de vídeo do YouTube por exercício

### Relatórios e evolução
- [ ] Gráficos de evolução por exercício com Recharts
- [ ] Histórico de sessões do atleta

### Pagamentos
- [ ] Integração Stripe para plano `pro` do trainer

---

## Arquitetura — decisões registradas
- Áudio nunca processado no frontend — sempre via Edge Function (chave OpenAI fica server-side)
- Vídeos sempre do YouTube — nunca hospedar próprios
- `set_logs` são imutáveis — soft-delete via campo `deleted`
- Migrations sempre aditivas — nunca remover coluna sem rollback
- `onAuthStateChange` + queries ao banco causam deadlock no Supabase JS v2 — usar `setTimeout(() => fn(), 0)` antes de qualquer query dentro do callback
- `supabase.auth.getSession()` preferível a `getUser()` em funções de API (evita requisição de rede desnecessária)
- `athletes.id` não é alterado após criação — vinculação com Auth via coluna separada `auth_user_id`
- `initAuth` verifica atleta antes de trainer (trigger cria linha em trainers para todo signup, inclusive atletas)
