# FitFlow — Status do Projeto

**Última atualização:** 16/04/2026 (sessão 7)
**Produção:** https://fitflow-bay-nine.vercel.app

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
- [x] `transcribe-audio` — deployada via `npx supabase functions deploy`
- [x] `parse-workout` — deployada via `npx supabase functions deploy`
- [x] Secrets configurados: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- [x] Bucket `audio` criado no Supabase Storage (public) — política RLS de upload corrigida (migration `20260412000003`)
- [x] Edge Functions redeployadas com `--no-verify-jwt` (resolveu erro 401)
- [x] `parse-workout` funcionando — créditos Anthropic confirmados (problema era propagação do pagamento)

### Integrações externas (`src/lib/`)
- [x] `supabase.ts` — cliente Supabase
- [x] `whisper.ts` — upload para Storage + invoke Edge Function
- [x] `claude.ts` — invoke Edge Function `parse-workout`
- [x] `youtube.ts` — busca de vídeos via YouTube Data API v3
- [x] `api.ts` — camada central com todas as operações CRUD + `createAthlete`, `getAthleteByAuthId`, `linkAthleteAccount`, `getAthleteWorkouts`

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
- [x] Aba Treinos: gravar áudio (MediaRecorder), upload de arquivo de áudio ou **digitar/colar texto** (toggle Áudio/Texto)
- [x] Status do treino em tempo real (pending → transcribing → parsing → ready | error)
- [x] Expandir treino para ver exercícios extraídos

### Página de Convite (`/invite/:token`) — `InvitePage.tsx`
- [x] Busca atleta pelo invite token (política pública de RLS)
- [x] Cadastro com email/senha (sinaliza `role: 'athlete'` no metadata para não criar linha em trainers)
- [x] Login para atletas que já têm conta
- [x] Vinculação automática de `auth_user_id` após autenticação

### Tela do Atleta (`/athlete`) — `WorkoutPage.tsx`
- [x] Exibir treino mais recente com status `ready`
- [x] Iniciar sessão (`startSession`)
- [x] Check-in por série: reps feitas + peso opcional
- [x] Registro de `set_logs` por série concluída
- [x] Séries concluídas marcadas em verde
- [x] Concluir sessão quando todas as séries forem feitas
- [x] Timer de descanso entre séries — banner fixo no rodapé com countdown MM:SS, barra de progresso e botão "Pular" ✅ testado
- [x] Embed de vídeo YouTube por exercício — iframe 16:9, só aparece se `youtube_video_id` preenchido ✅ testado
- [x] Aba Histórico — sessões expandíveis com resumo por exercício (séries + peso máximo) ✅ testado
- [x] Gráficos de evolução (Recharts) — peso máximo e média de reps por exercício ao longo das sessões ✅ testado
- [x] Botão "Ver meu histórico" na tela de treino concluído — recarrega sessões e abre aba Histórico
- [x] Sugestão de peso no campo de série — peso prescrito como valor inicial; último peso do histórico como placeholder

### Tipos TypeScript
- [x] `Athlete` atualizado com campo `auth_user_id: string | null`
- [x] `Exercise` atualizado com campo `weight_kg: number | null`

### Componentes
- [x] `LoadingSpinner.tsx`

---

## Bugs conhecidos

- [x] ~~Créditos Anthropic insuficientes~~ — resolvido (propagação do pagamento)
- [x] ~~Erro 406 no endpoint do trainer~~ — corrigido: `.single()` → `.maybeSingle()` ✅ testado em produção
- [x] ~~Tela do atleta em branco~~ — corrigido: `useMemo` estava após early returns (violação de Rules of Hooks)

---

## Pendente

### Deploy
- [x] Repositório GitHub: https://github.com/tatipaula/fitflow
- [x] Deploy no Vercel: https://fitflow-bay-nine.vercel.app


### Relatórios e evolução
- [x] Histórico de sessões do atleta ✅ testado
- [x] Gráficos de evolução por exercício com Recharts ✅ testado

### Pagamentos
- [ ] Integração Stripe para plano `pro` do trainer

---

## Integrações externas
- [x] YouTube Data API v3 — chave `VITE_YOUTUBE_API_KEY` configurada no `.env` e no Vercel; busca automática de vídeo após parsing ✅ testado em produção

## Arquitetura — decisões registradas
- Áudio nunca processado no frontend — sempre via Edge Function (chave OpenAI fica server-side)
- Vídeos sempre do YouTube — nunca hospedar próprios
- `set_logs` são imutáveis — soft-delete via campo `deleted`
- Migrations sempre aditivas — nunca remover coluna sem rollback
- `onAuthStateChange` + queries ao banco causam deadlock no Supabase JS v2 — usar `setTimeout(() => fn(), 0)` antes de qualquer query dentro do callback
- `supabase.auth.getSession()` preferível a `getUser()` em funções de API (evita requisição de rede desnecessária)
- `athletes.id` não é alterado após criação — vinculação com Auth via coluna separada `auth_user_id`
- `initAuth` verifica atleta antes de trainer (trigger cria linha em trainers para todo signup, inclusive atletas)
