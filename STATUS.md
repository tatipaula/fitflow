# Kinevia — Status

## Última atualização: 2026-06-11 (sessão 29)

---

## Concluído

### Sessão 29 — Investimento em anúncios na /trial/stats (entrada manual)

Objetivo: ter o panorama completo da fase de validação cruzando gasto de mídia com o funil que a página já media.

#### Decisão de arquitetura
- Caminho da Meta Marketing API (Edge Function + System User token) foi **adiado**: a obtenção do token via Graph API Explorer travou em permissões (`ads_read`/casos de uso do app) e não compensava o esforço na fase de validação
- Adotada **entrada manual do gasto** — mesmo painel de custo, zero dependência de token/agência. A tabela e os cards já ficam prontos para plugar a automação por cima depois

#### Banco de dados
- Migration `20260611000002_ad_spend.sql`: tabela `ad_spend` (`spend_date` PK, `amount_brl`, `source`, `updated_at`) — gasto por dia em BRL; mesmo modelo de segurança do `page_events` (anon lê/grava via cliente anônimo, protegido pela senha client-side da página). Também criou `count_trainers_in_window(p_days)` — **depois substituída e removida** (ver abaixo)
- Migration `20260611000003_validation_activation.sql`: função `validation_activation(p_days int)` security definer que retorna **só agregados** (`new_trainers`, `activated_trainers`, `athletes_total`) — zero PII, seguro para o anon. Mede ativação real: dos trainers criados na janela, quantos cadastraram ≥1 aluno
- Migration `20260611000004_drop_count_trainers_fn.sql`: removeu `count_trainers_in_window` (órfã — `validation_activation` já devolve `new_trainers`, então a página passou a usar só ela; uma RPC a menos por carregamento)

#### Frontend — `src/pages/trial/TrialStatsPage.tsx`
- Bloco "Investimento em anúncios — Meta Ads" com 5 cards de custo: **Gasto total**, **Custo por sessão** (÷ sessões únicas), **Custo por lead** (÷ sessões que clicaram no CTA), **Custo por cadastro** (÷ novos trainers), **Custo por ativado** (÷ trainers que cadastraram aluno — o número honesto da validação)
- Card "Trainers ativados" na grade de KPIs do topo: `ativados/novos`, taxa de ativação % e total de alunos cadastrados
- Input inline: data + valor → upsert em `ad_spend` (re-salvar o mesmo dia sobrescreve); `reloadKey` re-busca os dados após salvar
- Fetch dos 3 datasets (page_events, ad_spend, `validation_activation`) paralelizado em `Promise.all`; tudo respeita o seletor de janela 7d/14d/30d
- Componente `MiniStat` e helper `fmtBRL` adicionados
- 2 deploys em produção ✓

#### Snapshot de ativação no dia (janela 14d)
- 6 trainers novos, **2 ativaram** (cadastraram aluno), 3 alunos no total → ~33% de ativação. Nos últimos 7d: 5 novos, só 1 ativado. Ativação (não cadastro) é o gargalo visível da validação.

---

### Sessão 28 — Fix do link de convite inválido + fluxo de recuperação de senha

#### Bug raiz: dois sistemas de convite misturados
- Diagnóstico: alunos do Marcos recebiam "link inválido" ao reenviar acesso
- Causa: `handleSendAthleteAccess` usava `athletes.invite_token` (sistema antigo, rota `/invite/`) montando URL `/convite/` (sistema novo, tabela `invites`) — o token nunca existia na tabela consultada
- `createInviteForAthlete` adicionada a `api.ts`: todo reenvio agora cria registro novo na tabela `invites` (token fresco, 7 dias)
- Botão "Convite" dos cards de alunos migrado para o mesmo fluxo (antes copiava link da rota antiga)
- Falha na geração do invite agora exibe "✗ Erro ao gerar link" (antes falhava em silêncio)

#### ConvitePage — modo "Já tenho conta"
- Toggle Criar senha / Já tenho conta no step 1
- Login vincula a conta na mesma tela (`linkAthleteByInviteToken`) e re-resolve o role via `initAuth` — corrige race condition com o `onAuthStateChange` do App.tsx
- Resultado do RPC de vínculo agora é verificado nos dois caminhos (cadastro e login); convite inválido mostra mensagem clara em vez de criar conta órfã silenciosamente
- Erro "email já cadastrado" oferece atalho "Entrar com minha conta →" (steps 1 e 3)

#### ResetPasswordPage — validação de sessão de recovery
- Página agora valida a sessão no mount: hash com `#error=` (link expirado/usado) ou ausência de sessão exibe tela "Link inválido ou expirado" com botão para solicitar novo
- Bug grave corrigido: com link expirado + outra pessoa logada no dispositivo, o submit trocava a senha de quem estava logado
- Hash capturado no import do módulo (supabase-js pode limpá-lo antes do mount)
- Mensagens de erro específicas (senha igual à anterior, senha curta)

#### Conta órfã da Luiza Melucci — correção manual na base
- Padrão descoberto: usuário existe no auth mas `athletes.auth_user_id` é null → login funciona, role resolve null, usuário fica em limbo
- Luiza tinha conta desde 30/05 (cadastro via convite cuja vinculação falhou — era a confirmação de email, desativada na sessão 20)
- Corrigida via admin API: senha redefinida + `auth_user_id` e email vinculados à linha da atleta; login testado de ponta a ponta via REST
- Scan completo da base: Luiza era a única órfã real; Marcos Cabral (aluno) segue sem ativação mas sem email/telefone cadastrados — pendência do trainer, não do código
- Verificado: Redirect URLs do Supabase Auth tem `https://kinevia.com.br/**` (cobre `/reset-password`)
- 3 deploys em produção ✓

---

### Sessão 27 — Meta Pixel

- Pixel `1611941487599974` adicionado ao `index.html` (fornecido pela agência)
- `<script>` no `<head>`; `<noscript>` movido para o `<body>` (parser HTML5 do `vite-plugin-pwa` não permite `<img>` dentro de `<noscript>` no `<head>`)
- Dispara `PageView` em todas as rotas, incluindo `/trial` (destino dos anúncios)
- Deploy em produção ✓

---

### Sessão 26 — Histórico de pagamentos, seleção de método de prescrição, evolução de carga e insights Oura Ring

#### Histórico de pagamentos (`payment_logs`)
- Tabela `payment_logs` criada (migration `20260608000001_payment_logs.sql`) com campos `athlete_id`, `trainer_id`, `paid_at`, `amount`, `confirmed_by` (trainer | athlete), RLS para ambos os lados
- Interface `PaymentLog` adicionada a `src/types/index.ts`
- `confirmPayment` em `api.ts` atualizado: além de gravar `last_paid_at` no atleta, insere log com quem confirmou
- `getPaymentLogs` adicionado a `api.ts`: retorna até 24 lançamentos ordenados por data desc
- Dashboard do trainer: card "Histórico de pagamentos" exibido no detalhe do atleta quando `billing_day` está configurado; ponto dourado = confirmado pelo atleta, cinza = pelo trainer
- Atleta: botão "Paguei ✓" no WorkoutPage grava `confirmed_by: 'athlete'`
- Seed de dados de teste para Arnold: 24 sessões em 12 semanas com progressão de 2.5%/semana nos 5 exercícios base (`seed_arnold.sql`)

#### Seleção de método de prescrição (audio vs biblioteca)
- Substituído card único de áudio por grade 2 colunas no DashboardPage:
  - **Gravar áudio**: card clicável → `inputMode = 'audio'`, abre gravação
  - **Biblioteca**: card clicável → `inputMode = 'text'`, abre biblioteca de exercícios
- Estado vazio do detalhe do atleta: dois botões lado a lado com o mesmo split

#### Gráfico de progressão de carga por exercício
- Evolution tab do WorkoutPage (aluno) agora inclui:
  - Dropdown para selecionar exercício (apenas exercícios com ≥ 2 pontos históricos, ordenados por frequência)
  - Card âncora "Início X kg → Hoje Y kg (+Z%)" calculado em `useMemo` sobre `sessions` existentes
  - LineChart com CartesianGrid mostrando carga máxima por sessão ao longo do tempo
- Lógica em `exerciseProgressData` useMemo: agrupa por exercício, pega máximo por sessão, ordena cronologicamente

#### Insights Oura Ring-style
- Tira horizontal scrollável no topo da aba Evolução do aluno
- Cada card: borda esquerda 3px verde/vermelho/neutro, número delta grande, label mono pequeno
- Indicadores calculados: delta de carga por exercício (último vs penúltimo), delta de volume total (%), delta de frequência semanal (esta semana vs anterior)
- Limitado a 8 cards, ordenados por magnitude absoluta do delta
- Deploy em produção ✓

---

### Sessão 25 — Revisão de copy da página /trial

- **Hero**: parágrafo substituído por dois — proposta de valor (15→2 min) + sub-copy de descrição; linha "15 dias grátis. Sem cartão de crédito." adicionada acima do CTA
- **Como funciona**: verbos no imperativo (Grave / Estruture / Envie), novos textos de descrição, bloco "Resultado — Menos digitação. Menos retrabalho. Mais alunos atendidos." adicionado ao fim da seção
- **Experiência do aluno**: parágrafo de abertura reescrito ("Você não precisa configurar nada…") + sub-linha "Sem App Store. Sem Play Store. Sem atrito."
- **Sem/Com Kinevia**: reestruturado — 4 itens texto corrido na coluna Sem, 5 itens na coluna Com; coluna Com em Cormorant INK peso 500 (era GOLD itálico 300, visualmente apagado)
- **Depoimento**: frase de destaque em fonte maior e centralizada + texto de suporte separado; assinatura em duas linhas (nome / ocupação)
- **Última dobra**: "Comece com clareza" → "Teste o Kinevia por 15 dias" + "Descubra quanto tempo…" + "Sem cartão. Cancele quando quiser."
- **CTA pricing**: "Crie sua conta em 2 minutos." + ancoragem de preço "Um valor fixo. Sem cobrança por aluno." + "Funciona para quem tem 5 alunos ou 50."
- **Validação**: zero travessões, zero exclamações, zero emojis; "Na Kinevia" corrigido para "No Kinevia"
- Deploy em produção ✓

---

### Sessão 24 — Página de vendas /trial + analytics próprio

#### Página de vendas (`kinevia.com.br/trial`)
- Rota pública `/trial` adicionada ao React Router
- 6 seções no estilo editorial bicromático do Manual de Identidade:
  - **Hero** (Paper): eyebrow mono gold, H1 Cormorant com acento gold itálico, animação de phone do app, CTA primário
  - **Como funciona** (Ink): 3 passos — gravar, estruturar, enviar
  - **Jornada do aluno** (Paper): mata a objeção "precisa instalar?" — link de convite, onboarding 3 passos, ficha estruturada
  - **O que muda** (Paper-2): comparação factual antes/depois ancorada no tempo por tarefa (15–20 min → ~2 min)
  - **Depoimento** (Paper): Marcos Matias Xavier, texto aprovado
  - **Preço + CTA final** (Black): "Comece com clareza. 15 dias, sem cartão. R$49/mês depois."
- 4 CTAs rastreados individualmente: `hero`, `after-how-it-works`, `after-testimonial`, `pricing`
- Nav fixa com fundo transparente → opaco ao scroll, CTA gold sobre dark
- Animação do phone: state machine (idle → recording → processing → reveal → done), waveform dinâmico, ficha com reveal progressivo
- Copy fiel ao brief: sem exclamações, sem emojis, gold apenas como accent, claims honestos
- CTA aponta para `/login` (fluxo de cadastro do app)

#### Analytics próprio — sem agência, sem scripts externos
- `src/lib/analytics.ts`: lib de tracking sobre Supabase; `sessionStorage` por visita; `try/catch` que nunca quebra a página
- Eventos capturados: `page_view` (com UTM params), `section_view` (IntersectionObserver, once), `cta_click` (posição exata), `scroll_depth` (25/50/75/100%), `session_end` (tempo total + profundidade máxima)
- Tabela `page_events` no Supabase com RLS: anon pode inserir, authenticated pode ler
- Migration `20260607000001_page_events.sql` aplicada

#### Dashboard de estatísticas (`kinevia.com.br/trial/stats`)
- Acesso por senha própria (`VITE_STATS_PW` no `.env`) — sem dependência de login de trainer
- Sessão preservada na aba via `sessionStorage`; fecha a aba e pede senha novamente
- Painéis: sessões únicas, cliques no CTA + taxa de conversão, funil de seções, profundidade de scroll, cliques por posição do CTA, sessões por dia (sparkbar), origens de tráfego (top 6), tempo médio na página
- Seletor de janela de tempo: 7d / 14d / 30d

#### Infra
- `index.html`: DM Sans 300 adicionado ao carregamento de fontes
- Deploy em produção ✓ (`kinevia.com.br`)

---

### Sessão 23 — Automação de emails via pg_cron (offer-plans + recovery)

#### offer-plans — aviso D-3 do trial
- Edge function refatorada com **batch mode**: quando chamada sem `trainer_email` no body, consulta o DB e envia para todos os trainers com `plan='free'` e `trial_ends_at` exatamente 3 dias à frente
- Email com assunto "Seu trial acaba em 3 dias" e CTA de assinatura R$49/mês
- Modo single ainda funciona para teste manual com `{ trainer_email }`
- pg_cron job `offer-plans-daily`: `0 12 * * *` (9h BRT)

#### recovery — carrinho abandonado (disparo único)
- Edge function refatorada com **batch mode**: consulta trainers com `stripe_customer_id IS NOT NULL`, `stripe_subscription_id IS NULL`, `plan='free'` e `recovery_email_sent = false`
- Envia email "Ainda pensando no plano?" — disparo **único por trainer** (marca flag no sucesso)
- Coluna `recovery_email_sent boolean NOT NULL DEFAULT false` adicionada a `trainers`
- pg_cron job `recovery-daily`: `0 13 * * *` (10h BRT)

#### Infra
- `pg_net` habilitado no projeto Supabase
- Migration `20260604000002_cron_emails.sql` aplicada
- Deploy das duas edge functions em produção ✓

---

### Sessão 22 — Gateway de pagamento Stripe + planos + trial

#### Modelo de negócio implementado
- Plano único **Pro — R$49/mês** (early adopter, cancele quando quiser)
- Trial de **15 dias sem cartão** para novos cadastros
- **Grandfathering permanente**: todos os trainers cadastrados antes de 04/06/2026 receberam `plan='pro'` automaticamente via migration

#### Banco de dados
- Migration `20260604000001_stripe_plans.sql`:
  - Colunas `trial_ends_at timestamptz` e `stripe_subscription_id text` adicionadas a `trainers`
  - `UPDATE trainers SET plan = 'pro'` — grandfathering de todos os usuários existentes
  - Trigger `handle_new_trainer` atualizado: novos cadastros ficam `plan='free'` + `trial_ends_at = now() + 15 days`
- Tipos `Trainer` atualizados em `src/types/index.ts`

#### Edge functions
- `stripe-checkout`: cria/reutiliza Stripe Customer e retorna URL do Checkout Session (mode: subscription); deployada com JWT obrigatório
- `stripe-webhook`: processa `checkout.session.completed` (→ `plan='pro'` + dispara `purchase-confirmed`) e `customer.subscription.deleted` (→ `plan='free'`); deployada com `--no-verify-jwt`; assinatura verificada via HMAC-SHA256

#### Stripe (livemode)
- Produto **Kinevia Pro** criado (`prod_UdzpWNhzOZVsPB`)
- Preço R$49/mês BRL criado (`price_1TehqBLfZ8saL5kFCWul5uT0`)
- Webhook registrado (`we_1TehqLLfZ8saL5kFy3MWGGTs`) → `https://yxrmiuldmywsgrcpiuos.supabase.co/functions/v1/stripe-webhook`
- Secrets configurados no Supabase: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`

#### Frontend
- `src/lib/api.ts`: helpers `hasActiveAccess()`, `trialDaysLeft()`, `createCheckoutSession()`
- `src/pages/trainer/PaywallPage.tsx`: tela de assinatura exibida quando trial expira — lista de features, preço, botão que abre Stripe Checkout
- `src/App.tsx`: `TrainerRoute` — gating que exibe `PaywallPage` ou `DashboardPage` conforme acesso; polling pós-pagamento exibe "Confirmando pagamento..." por até 15s após redirect do Stripe, entrando no dashboard assim que webhook atualizar `plan=pro`
- `src/pages/trainer/DashboardPage.tsx`: banner de trial com contagem regressiva e botão "Assinar" para trainers em período gratuito
- Deploy em produção ✓

---

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

- **Stripe livemode**: testar fluxo completo com cartão real (até agora testado apenas com `sk_test_`)
- **Emails — verificar CTA**: link dos emails corrigido de `/planos` para `/trainer`; confirmar que botão leva ao checkout corretamente com trainer em trial real

---

## Backlog

- **Remover sistema de convite antigo**: rota `/invite/:token`, `InvitePage.tsx`, campo `athletes.invite_token` e helpers associados (`getAthleteByInviteToken`, `linkAthleteAccount`, `pending_invite_token` no App.tsx). Ninguém mais gera esses links desde a sessão 28; é código morto que causou o bug do link inválido por confusão entre os dois sistemas
- **Automatizar gasto de anúncios (opcional)**: a sessão 29 entregou a versão manual (tabela `ad_spend` + cards de custo na `/trial/stats`). Para automatizar, plugar uma Edge Function que puxe gasto/CPM/cliques/CTR da Meta Marketing API e faça upsert em `ad_spend` (token seguro no servidor via secret + cron diário, padrão check-billing). Pré-requisitos: Ad Account ID (`act_XXXXXXXXX`) e token com `ads_read` — obtenção do token travou no Graph API Explorer (permissões do app), reavaliar se/quando o volume justificar.
- Integração WhatsApp para notificações de cobrança
- Auto-completar programa via trigger já implementado — validar em produção com dados reais
