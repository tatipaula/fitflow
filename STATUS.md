# Kinevia — Status do Projeto

**Última atualização:** 26/04/2026 (sessão 14)
**Produção:** https://kinevia.com.br (DNS em propagação — fallback: https://fitflow-bay-nine.vercel.app)

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
- [x] `youtube.ts` — busca de vídeos via YouTube Data API v3 com filtro `videoDuration=short`
- [x] `api.ts` — camada central com todas as operações CRUD + `createAthleteWithInvite`, `getInviteByToken`, `linkAthleteByInviteToken`, `saveParqResponse`, `getParqResponse`, `assignWorkoutToAthletes`

### Estado global (`src/stores/authStore.ts`)
- [x] Zustand store com `role`, `trainer`, `athlete`, `loading`
- [x] `initAuth(userId)` — verifica atleta (por `auth_user_id`) primeiro, depois trainer
- [x] `clearAuth` com `loading: false`

### Roteamento (`src/App.tsx`)
- [x] Rotas: `/login`, `/invite/:token`, `/convite/:token`, `/trainer`, `/athlete`
- [x] `onAuthStateChange` com `setTimeout` para evitar deadlock de queries dentro do callback
- [x] Token de convite pendente (`pending_invite_token` e `pending_convite_token`) vinculado após confirmação de email
- [x] PAR-Q pendente (`pending_parq_answers` + `pending_parq_athlete_id`) salvo após confirmação de email

### Autenticação
- [x] `LoginPage.tsx` — login e cadastro com email/senha para trainers
- [x] Persistência de sessão via `onAuthStateChange`
- [x] Redirecionamento por role após login

### Design System (sessão 8–9)
- [x] Redesign completo — tema editorial dark com paleta ink/fg/accent (amber oklch)
- [x] `index.css` — CSS vars, classes `.eyebrow`, `.display`, `.num`, animações kv-rise/kv-pulse/kv-spin
- [x] `tailwind.config.ts` — tokens ink/fg/accent/paper/radii via CSS vars
- [x] `src/components/ui/index.tsx` — primitivos KV: KVLogo, KVWordmark, KVButton, KVTag, KVCard, KVMeter, KVDivider, KVAvatar, KVIcon
- [x] Fontes: Instrument Serif (display), JetBrains Mono (mono/eyebrow/num), Geist (sans)
- [x] Layout responsivo: sidebar 220px desktop + header/bottom-nav mobile (`useIsMobile`)

### Painel do Personal (`/trainer`) — `DashboardPage.tsx`
- [x] Header mobile com botão "Sair" + "Novo Treino"; sidebar desktop com nav + sign out
- [x] 3 abas: Dashboard (stats + mini-lista alunos + CTA áudio), Alunos (busca + cards + convite), Treinos (lista expandível)
- [x] Gravar áudio (MediaRecorder), upload de arquivo ou **digitar/colar texto** (toggle Áudio/Texto)
- [x] Campo de nome do treino (ex: "Pernas A", "Costas B") ao criar
- [x] Status do treino em tempo real (pending → transcribing → parsing → ready | error)
- [x] Expandir treino para ver exercícios; nome do treino exibido na lista
- [x] **Renomear treino** — edição inline no card expandido (Enter salva, Esc cancela)
- [x] **Excluir treino** — botão vermelho com confirmação antes de deletar
- [x] **Notificação por email ao atleta** — Edge Function `notify-athlete` via Resend; remetente provisório `onboarding@resend.dev` (trocar quando domínio Resend verificado)

### Página de Convite (`/convite/:token`) — `ConvitePage.tsx`
- [x] Busca atleta pelo invite token (política pública de RLS)
- [x] Cadastro com email/senha (sinaliza `role: 'athlete'` no metadata para não criar linha em trainers)
- [x] Login para atletas que já têm conta
- [x] Vinculação automática de `auth_user_id` após autenticação

### Tela do Atleta (`/athlete`) — `WorkoutPage.tsx`
- [x] **Múltiplos treinos ativos** — tela de seleção de fichas quando há mais de uma disponível; botão "Trocar ficha" no card
- [x] Layout mobile-first com accordion: todos os exercícios visíveis, tap para expandir e registrar série inline
- [x] Iniciar sessão (`startSession`); auto-expande próximo exercício após concluir todos os sets de um
- [x] Check-in por série: reps feitas + peso opcional; dots de progresso por exercício
- [x] Timer de descanso — banner flutuante acima da bottom nav com countdown MM:SS e botão "Pular"
- [x] Embed de vídeo YouTube por exercício dentro do accordion expandido
- [x] 2 abas: Treinos / Evolução (bottom nav com ícones)
- [x] Evolução: Volume Total (line chart) + Frequência Semanal (bar chart) + Evolução de Carga por exercício (progress bars)
- [x] Botão "Sair" no cabeçalho de todas as telas do atleta

### PWA (sessão 14 — 26/04/2026)
- [x] `vite-plugin-pwa` configurado com manifest, service worker e workbox
- [x] Ícones: 64×64, 192×192, 512×512, maskable 512×512, apple-touch-icon 180×180, favicon.ico
- [x] Ícone: monograma "K" geométrico sobre fundo dark (#0E0D0B)
- [x] Meta tags Apple: `apple-mobile-web-app-capable`, `status-bar-style`, `apple-touch-icon`
- [x] `PWAInstallBanner` na LoginPage — Android: prompt nativo; iOS: instrução com ícone Share
- [x] Estratégias de cache: Fonts CacheFirst 1 ano, YouTube CacheFirst 7 dias, Supabase NetworkFirst

### Renomeação FitFlow → Kinevia (sessão 14 — 26/04/2026)
- [x] Todos os textos visíveis ao usuário atualizados
- [x] Componentes renomeados: FF* → KV* (KVLogo, KVButton, KVIcon…)
- [x] CSS keyframes: ff-* → kv-*
- [x] Edge functions `notify-athlete` e `send-invite` atualizadas e redeployadas
- [x] Domínio `kinevia.com.br` + `www.kinevia.com.br` adicionados ao Vercel
- [x] DNS aguardando propagação (A record: `76.76.21.21`)

### Banco de dados — Migrations
- [x] `20260419000001_add_workout_name.sql` — coluna `name text` na tabela `workouts`
- [x] `20260423000001_add_athlete_fields.sql` — `phone`, `weight_kg` em `athletes`; `email` nullable
- [x] `20260423000002_create_invites.sql` — tabela `invites` com expiração
- [x] `20260423000003_create_parq_responses.sql` — tabela `parq_responses`

### Sessão 11 (20/04/2026)
- [x] Editar exercícios de um treino já criado (séries, reps, peso, descanso, notas)
- [x] Vídeo YouTube no painel do personal — botão "Vídeo" por exercício no card expandido
- [x] Tela do atleta sem treino ativo — card explicativo + histórico de sessões recentes
- [x] Preenchimento automático de carga pelo histórico

### Sessão 12 (21/04/2026)
- [x] Pipeline simplificado — spinner "Processando..." em vez de steps detalhados
- [x] Tela de revisão do treino antes de confirmar e enviar ao atleta
- [x] Fix botão parar gravação no iOS Safari

### Sessão 13 (23/04/2026)
- [x] Detalhe do aluno no painel — treino atual + PAR-Q
- [x] Cadastro de aluno com nome/email/phone/peso + convite WhatsApp ou email
- [x] PAR-Q no onboarding via `/convite/:token`
- [x] Atribuir treino para múltiplos alunos (cópias independentes)
- [x] Edge function `send-invite` (email de convite via Resend)

---

## Bugs conhecidos

- [x] ~~Créditos Anthropic insuficientes~~ — resolvido
- [x] ~~Erro 406 no endpoint do trainer~~ — corrigido
- [x] ~~Tela do atleta em branco~~ — corrigido (Rules of Hooks)

---

## Pendente

### Domínio e email
- [ ] Verificar propagação DNS de `kinevia.com.br` (A record `76.76.21.21`) — aguardando ~3h
- [ ] Configurar domínio no Resend e trocar remetente de `onboarding@resend.dev` para `no-reply@kinevia.com.br`

### Monetização
- [ ] Decidir canal (web vs app store) antes de implementar Stripe
- [ ] Implementar plano Pro para trainers

---

## Integrações externas
- [x] YouTube Data API v3 — `VITE_YOUTUBE_API_KEY`
- [x] Resend — emails de convite e notificação de treino
- [ ] Stripe — pendente decisão de canal

## Arquitetura — decisões registradas
- Áudio nunca processado no frontend — sempre via Edge Function (chave OpenAI fica server-side)
- Vídeos sempre do YouTube — nunca hospedar próprios
- `set_logs` são imutáveis — soft-delete via campo `deleted`
- Migrations sempre aditivas — nunca remover coluna sem rollback
- `onAuthStateChange` + queries ao banco causam deadlock no Supabase JS v2 — usar `setTimeout(() => fn(), 0)` antes de qualquer query dentro do callback
- `supabase.auth.getSession()` preferível a `getUser()` em funções de API (evita requisição de rede desnecessária)
- `athletes.id` não é alterado após criação — vinculação com Auth via coluna separada `auth_user_id`
- `initAuth` verifica atleta antes de trainer (trigger cria linha em trainers para todo signup, inclusive atletas)
- Componentes auxiliares nunca definir dentro do corpo do componente pai — causa remount a cada render
- Convite antigo (`/invite/:token`) mantido para backward compat; novo fluxo usa `/convite/:token` com tabela `invites` separada
- Treinos atribuídos são cópias físicas por atleta (INSERT por aluno) — editar um não afeta os demais
