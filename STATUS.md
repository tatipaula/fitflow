# Kinevia — Status

## Última atualização: 2026-06-03 (sessão 21)

---

## Concluído

### Sessão 21 — CREF, bi-set/tri-set, biblioteca expandida e UX do dashboard

#### CREF do personal trainer
- Campo `cref text` adicionado à tabela `trainers` (migration `20260603000001_trainer_cref.sql`)
- Tipo `Trainer` atualizado em `src/types/index.ts`
- `updateTrainerProfile` em `api.ts` aceita o campo `cref`
- Formulário de perfil do trainer: campo CREF editável (acima do telefone), exibido na visualização
- Aluno: card "Meu Personal" na aba Perfil exibe avatar, nome, CREF, telefone e bio do personal
- Trainer sempre carregado no `WorkoutPage` (não só quando há cobrança pendente)
- Deploy em produção ✓

#### Suporte a bi-set, tri-set, circuito e drop-set
- Colunas `group_id integer` e `method text` adicionadas à tabela `exercises` (migration `20260603000002_exercise_groups.sql`)
- Tipo `ExerciseMethod` e campos `group_id`, `method` adicionados à interface `Exercise`
- Edge function `parse-workout` atualizada: IA detecta agrupamentos por palavras-chave ("biset", "triset", "circuito", "dropset", "supersérie") e retorna `group_id` e `method`
- **Trainer — revisão do treino**: exercícios agrupados exibidos em container accent com badge (BI-SET, TRI-SET, CIRCUITO, DROP-SET); exercícios isolados sem alteração
- **Atleta — execução**: exercícios do grupo rendem visualmente com badge e letras A/B/C; lógica de `handleLogSet` corrigida — sem descanso entre exercícios do grupo, descanso apenas ao fim da rodada completa
- Deploy edge function + frontend em produção ✓

#### Biblioteca de exercícios expandida
- Grupos expandidos de ~8 para ~20 exercícios cada
- Total: de ~80 para ~200 exercícios
- Novo grupo **Glúteos** (20 exercícios): hip thrust, abdução, clamshell, monster walk, step up, etc.
- Cardio: battle rope, kettlebell swing, assault bike, shadowboxing, agility ladder e mais
- Costas: barra fixa, chin-up, T-bar, remada inversa, serrote, good morning
- Core: ab rollout, pallof press, dragon flag, hollow body, V-sit, windmill
- `CARDIO_EXERCISE_NAMES` atualizado para o parser da IA reconhecer os novos exercícios
- Deploy em produção ✓

#### UX — alunos clicáveis no dashboard (home)
- Cards de alunos na seção "Alunos" da home agora são clicáveis e abrem o detalhe do aluno
- Seta `>` adicionada ao lado direito de cada card indicando navegabilidade
- Botão "Ver todos" com destaque visual (fundo accent-soft, borda e texto accent)
- Deploy em produção ✓

---

### Sprint 1 — Check-in e pacote de aulas
- Tabela `class_checkins` criada (migration aplicada)
- Campo `sessions_total` em athletes
- Botão de check-in no card do atleta (feedback visual "✓ Registrado!")
- Contador de aulas restantes grande e visível, com cores de urgência (verde/âmbar/vermelho)
- Histórico de check-ins na tela de detalhe do atleta
- Deploy em produção ✓

### Sprint 2 — Biblioteca de exercícios
- `src/lib/exerciseLibrary.ts`: 9 grupos × ~8 exercícios (~72 no total)
- Grupos: Peito, Costas, Pernas, Ombros, Bíceps, Tríceps, Core, Mobilidade, Alongamento
- Exercícios de mobilidade/alongamento com `timed: true` (reps = segundos)
- Modal de biblioteca acessível pelo botão "Biblioteca" no modo texto do treino
- Deploy em produção ✓

### Sprint 3 — Cobranças com Push + Email
- Campos `billing_day`, `billing_amount` em athletes e `pix_key` em trainers (migration aplicada)
- Tabela `push_subscriptions` com RLS (migration aplicada)
- UI no DashboardPage: card de Pix do personal, seção de cobrança por atleta
- `src/lib/push.ts`: registro de push subscription via VAPID
- `src/sw.ts`: service worker customizado com handler de push e notificationclick
- `vite.config.ts`: modo `injectManifest` para service worker customizado
- Edge Function `check-billing` deployed no Supabase
- Cron configurado via pg_cron: `0 13 * * *` (10h Brasília)
- VAPID keys geradas e configuradas como Supabase secrets
- `VITE_VAPID_PUBLIC_KEY` configurada no Vercel
- Deploy em produção ✓

### Sprint 4 — Notificações in-app de cobrança
- Campo `last_paid_at date` adicionado à tabela `athletes` (migration aplicada)
- Atleta confirma pagamento via botão "Paguei ✓" no próprio app
- Banner de mensalidade no WorkoutPage: aparece quando billing_day ≤ hoje e não pago no mês corrente
- Sininho com badge no header do trainer (mobile) e sidebar (desktop)
- Status de cobrança nos cards dos atletas: "Mensalidade pendente" (âmbar) ou "Pago em DD/MM" (verde)
- Deploy em produção ✓

### Sprint 5 — Ranking, perfil do atleta e badges
- Ranking de alunos no dashboard do trainer (Treinos, Carga Total, Cardio, Check-ins)
- Pódio visual (top 3) com lista completa abaixo
- Perfil do atleta no WorkoutPage: nova aba com avatar, dados pessoais editáveis
- Badges: trainer atribui badges (ícone + título); atleta visualiza no perfil
- Campos `birth_date`, `height_cm`, `objective`, `avatar_url` em athletes (migration aplicada)
- Tabela `badges` com RLS (migration aplicada)
- Bucket `avatars` no Supabase Storage
- Deploy em produção ✓

### Correções de infra — onboarding e emails (sessão 20)
- **RESEND_API_KEY** atualizada nos secrets do Supabase (chave anterior revogada causava 500 em todas as edge functions de email)
- **Confirmação de email desativada** no Supabase Auth — no fluxo de convite é desnecessária e causava perda do `pending_convite_token` no localStorage quando o redirect não apontava para `kinevia.com.br`
- Fluxo de onboarding validado end-to-end: convite → step 1 (senha) → step 2 (PAR-Q) → step 3 (dados físicos) → atleta vinculado + dados salvos corretamente

### Sprint 14 — Lista de treinos limitada a 7 recentes (sessão 20)
- Treinos soltos ordenados por data desc no detalhe do atleta
- 7 mais recentes exibidos diretamente; restantes colapsados em "Anteriores (N)"
- Botão expansível com chevron animado
- Deploy em produção ✓

### Sprint 13 — Dashboard de evolução do atleta (sessão 20)
- Nova seção "Evolução" no detalhe do atleta (carregada em paralelo ao abrir)
- Gráfico 1: progressão de carga por exercício (line chart, top 10, mínimo 2 pontos)
- Gráfico 2: frequência semanal de sessões (bar chart, últimas 12 semanas)
- Gráfico 3: volume mensal acumulado (bar chart, últimos 6 meses, séries×reps×kg)
- `getAthleteEvolution` em `api.ts` processa tudo em uma query com join sessions→set_logs→exercises
- Recharts importado no DashboardPage pela primeira vez
- Deploy em produção ✓

### Sprint 12 — Troca de exercício no formulário de edição (sessão 20)
- Campo "Exercício" adicionado ao form de edição em ambos os contextos (review + lista de workouts)
- Autocomplete filtra a biblioteca de exercícios ao digitar (até 6 sugestões)
- Aceita nome livre para exercícios fora da biblioteca
- `UpdateExerciseInput` em `api.ts` recebe campo `name?` opcional
- Deploy em produção ✓

### Sprint 11 — Dados físicos no onboarding do atleta (sessão 20)
- Step 3 adicionado ao `ConvitePage.tsx`: peso (kg), altura (cm) e data de nascimento
- PAR-Q (step 2) avança para dados físicos antes de concluir o cadastro
- `handleSubmit` salva conta + PAR-Q + dados físicos em sequência via `updateAthleteProfile`
- `App.tsx`: processa `pending_parq_physical` do localStorage após confirmação de email
- Deploy em produção ✓

### Sprint 10 — Fix de overflow mobile + PWA auto-update (sessão 19)

#### Overflow horizontal no dashboard (iPhone)
- Header mobile: `flexShrink: 0` no "Sair", `flexShrink: 1 + minWidth: 0` no "Novo Treino", `gap: 6 + minWidth: 0` no grupo direito
- Grid de métricas: `repeat(3, minmax(0, 1fr))` + `minWidth: 0` nos cards
- Revertido `max-width: 100vw` em `html/body` e root div que causava clipping bilateral no iOS PWA standalone
- Deploy em produção ✓

#### PWA auto-update no iOS
- `src/sw.ts`: `skipWaiting()` no evento `install` + `clients.claim()` no `activate`
- `src/main.tsx`: `reg.update()` na inicialização e em cada `visibilitychange` — iOS PWA não verifica SW updates automaticamente ao abrir pelo ícone
- Removido `window.location.reload()` em `statechange === activated` que causava flash na instalação inicial
- Deploy em produção ✓

---

### Sprint 9 — Programas de treino + Módulo de cobranças (sessão 18)

#### Programas de treino
- Tabela `programs` com RLS: agrupamento de treinos por programa por atleta
- Colunas `program_id` e `program_order` adicionadas a `workouts` (nullable, aditivo)
- Trigger SQL `trg_check_program_completion` auto-completa programa quando todos os treinos têm sessão
- Migration `20260521000001_programs.sql` aplicada em produção
- Novos tipos: `Program`, `ProgramWithWorkouts`, `CreateProgramInput`, `ProgramStatus`
- API: `getProgramsByAthlete`, `getTrainerPrograms`, `createProgram`, `assignWorkoutToProgram`, `removeWorkoutFromProgram`, `updateProgramStatus`
- **Trainer — fluxo pós-áudio**: após confirmar treino, step opcional "Adicionar a um programa?"
- **Trainer — detalhe do atleta**: seção "Treinos" unificada (programas expansíveis + treinos soltos)
  - Treinos dentro de programa: clicáveis, expandem exercícios sob demanda
  - Treinos soltos: clicáveis + dropdown "Adicionar a programa..."
- **Trainer — visão global de Treinos**: busca por atleta/treino + tag de programa em cada card
- **Atleta — banner de programa ativo**: clicável, expande lista de dias do programa; cada dia inicia o treino direto
- Deploy em produção ✓

#### Módulo de cobranças
- Nova view "Cobranças" acessível pelo sininho (mobile header + sidebar desktop)
- Lista de atletas com billing configurado, ordenada por meses em aberto
- Filtro por chips: Todos / Pendente / Pago
- `calcOverdueMonths()` exportada de `api.ts`: calcula acúmulo real de meses em aberto a partir de `last_paid_at` + `created_at`
- Trainer: badge "N meses em aberto · R$ X devidos" + dois botões ("Quitar tudo" / "Só 1 mês")
- Atleta: banner exibe total acumulado correto + dois botões ("Paguei tudo ✓" / "Só 1 mês") quando há acúmulo
- "Só 1 mês" avança `last_paid_at` para o mês mais antigo pendente; contador reduz em 1 sem fechar o banner
- Mês de referência visível em cada linha (ex: `dia 10 · mai/25`)
- Deploy em produção ✓

### Sprint 8 — Chave Pix copiável no banner de cobrança (sessão 17)
- Chave Pix do treinador exibida no banner de mensalidade do aluno (label + container destacado)
- Botão "Copiar" com feedback visual "Copiado!" por 2 segundos via `navigator.clipboard`
- Bug corrigido: dados do atleta buscados direto do banco ao abrir o app (não mais do store em cache)
- Bug corrigido: banner usa `billingAthlete` (dados frescos) em vez do `athlete` do store
- RLS corrigida: nova política `athlete: select own trainer` permite aluno ler pix_key do treinador
- Auto-reload do PWA ao detectar novo service worker (`controllerchange` em `main.tsx`)
- Migration `20260518000001_trainer_readable_by_athlete.sql` aplicada
- Deploy em produção ✓

### Sprint 7 — Emails transacionais (sessão 16)
- Domínio `kinevia.com.br` verificado no Resend
- Remetente atualizado para `no-reply@kinevia.com.br` em todas as edge functions
- 4 novas edge functions: `welcome-trainer`, `offer-plans`, `purchase-confirmed`, `recovery`
- `welcome-trainer` conectado ao cadastro do trainer (`LoginPage.tsx` → `api.ts` → edge function)
- Deploy em produção ✓

### Sprint 6 — Melhorias de produto (sessão 15)
- **Posição do atleta no ranking**: aluno vê sua posição (1º/5, 2º/5...) por categoria no Perfil
  - Função RPC `get_athlete_ranking_position` (security definer, ranking mensal)
  - Grid de 4 métricas com medal emoji para top 3
- **Perfil do trainer**: nova aba "Perfil" no dashboard
  - Upload de foto, nome, telefone, bio editáveis
  - PIX em card separado e destacado
  - Bucket `trainer-avatars` no Supabase Storage
- **Avatares de atletas**: exibição corrigida em 3 pontos do dashboard (lista, detalhe, modal)
- **Pódio de ranking corrigido**: medalhas e alturas estavam invertidas (1º estava com prata)
- **Ranking mensal**: filtrado pelo mês atual; título mostra "Ranking maio"
- **Todos os treinos do aluno visíveis**: seção "Treinos" no detalhe do trainer lista todos os treinos ativos (antes mostrava apenas um)
- Deploy em produção ✓

---

## Pendências imediatas

- **Stripe**: definir canal de pagamento (web vs app store). Após decisão: implementar checkout, conectar `purchase-confirmed` no webhook, conectar `offer-plans` via pg_cron para plano free, conectar `recovery` para carrinhos abandonados.

---

## Backlog

- Histórico de pagamentos por mês (requer tabela `payment_logs`)
- Stripe: definir canal de pagamento (web vs app store) e implementar
- Métricas de evolução de cargas por exercício (histórico comparável)
- Integração WhatsApp para notificações de cobrança
- Auto-completar programa via trigger já implementado — validar em produção com dados reais
