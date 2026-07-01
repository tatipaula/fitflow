# Kinevia — Status

## Última atualização: 2026-07-01 (sessão 38)

---

## ⏭️ Plano de ativação dos leads — pendências e decisões

Plano de 4 tiers traçado na sessão 35 para fazer o lead **ativar o aluno real e virar cliente**. O **Tier 1 foi executado** (caixa inbound + checklist + fix de entregabilidade). Falta o que segue, em ordem de prioridade recomendada:

**1. Reduzir fricção do convite do aluno (Tier 2).** Hoje o `ConvitePage` tem 3 passos (senha → PAR-Q → dados físicos) e o aluno desiste no meio. O aluno precisa entrar rápido pro app "ganhar vida" (é o passo 3 do checklist lançado na sessão 35). **Ação:** tornar **PAR-Q e dados físicos opcionais/adiáveis** — entrar com só a senha, completar o resto depois. Prioridade 1 por sinergia direta com o checklist.

**2. Drip comportamental no trial, segmentado por ativação (Tier 3).** Hoje `offer-plans` (D-3) e `recovery` tratam todos igual. Falta nudge pra quem **não ativou**: D+1 sem aluno real → "cadastre seu primeiro aluno"; aluno criado sem treino → "monte o primeiro treino"; **só empurrar venda/paywall pra quem já ativou**. **Ação:** cron + edge function que segmenta trainers por estado (dados já existem: `signups_activation`, eventos do funil). A caixa de e-mail já está pronta.

**3. `from` humano nos e-mails de welcome + trial (sobra do Tier 1).** Trocar `no-reply@kinevia.com.br` por endereço humano (ex.: `tati@kinevia.com.br`) em `welcome-trainer` e `offer-plans` → founder-led onboarding (lead responde, Tatiana fala com quem travou). O `tati@` já cai no Gmail via catch-all do ImprovMX — sem DNS novo, só editar as edge functions. **Pendente 2 decisões da usuária:** (a) qual endereço; (b) manter o copy atual só trocando o remetente, ou reescrever com voz de fundadora (1ª pessoa).

**4. Conversão para pago por estado de ativação no `/trial/stats` (Tier 4).** Métrica que valida a tese inteira: "trainer que ativa aluno real converte mais que quem não ativa?". **Deixado por último de propósito** — é leitura e ganha confiabilidade com mais dias de dados do checklist rodando.

**Parcial / já encaminhado:** o reposicionamento do aluno demo como "máximo local" foi parcialmente atacado pelo checklist (sessão 35); falta a parte mais forte — deixar o demo levemente **read-only** pra não virar substituto do trabalho real.

---

## Concluído

### Sessão 38 — Acompanhamento (pagantes + uso real) + instrumentação do funil do aluno

Objetivo: checar trials vencidos / pagantes e ver se algum aluno usa de fato; fechar a cegueira de tracking do lado do aluno.

#### Diagnóstico (snapshot 01/07)
- **Zero pagantes reais.** `payment_logs` vazia, nenhum `stripe_subscription_id`. **Correção importante: o Stripe JÁ está conectado** (checkout web funcionando) — não é mais pendência; o que há é abandono no checkout. Os 2 `plan='pro'` seguem sendo Tatiana (conta dona) e Marcos (cortesia intencional).
- **Nenhum aluno EXTERNO registrou treino.** Base: 35 athletes → **13 reais** (22 `is_demo`). Só 4 têm login e nenhum treina. Os 2 únicos com sessão eram testes internos (Arnold-seed e "LF teste").
- **Marquei o seed `Arnold` como `is_demo=true`** (`2b5a33f7-…`, treinador Tatiana) — estava fora do flag e inflando "aluno real" com 68 sessões.
- **Funil vaza dos DOIS lados, em degraus opostos:** **Luiza Melucci** (treinador Marcos) — treinador montou **3 treinos**, aluna logou e **nunca iniciou** (trava no aluno); **Dias** (treinador Edvaldo) — aluno fez PAR-Q e ficou parado porque **o treinador nunca montou treino** (trava no treinador). Os outros 2 logados (Tatiana de Paula, LF teste) são teste.
- **Buraco de tracking confirmado:** `page_events` só instrumentava o app do **treinador** (214/3384 eventos com `user_id`, 34 user_ids, todos trainers, 0 alunos). O caso Luiza ("abriu e desistiu antes de iniciar") era invisível.

#### Ação — instrumentação do funil do aluno (commit `b8d7609`, push `master`, deploy auto em produção)
- Wrapper **`trackAthlete(event, athlete, data)`** em `src/lib/analytics.ts`: usa `athlete.auth_user_id` como `user_id`, injeta `role:'athlete'`+`athlete_id` no payload, **early-return se `is_demo`** (exclui demo na origem).
- **6 disparos** em `src/pages/athlete/WorkoutPage.tsx`: `athlete_app_opened` (+`ready_count`/`sessions_count`) e `athlete_no_workout` no `load()`; `workout_opened` no `selectWorkout`; `workout_session_started` no `handleStart`; `first_set_logged` (só 1ª série) no `handleLogSet`; `workout_session_completed` no `handleComplete`.
- Funil destravado: `select count(*) filter (where event=…) from page_events where data->>'role'='athlete'`. Torna mensuráveis os gaps Luiza (`app_opened` sem `session_started`) e Dias (`athlete_no_workout`).
- `tsc --noEmit` limpo. Deploy saiu **automático pelo push** (integração GitHub↔Vercel) — Ready em produção, `kinevia.com.br` já aponta pro novo build.

#### Pendente / próximo passo
- **Topo do funil do aluno ainda NÃO instrumentado** (aceitar convite → PAR-Q → 1º login) — vive em `ConvitePage`/`InvitePage`. Instrumentar num 2º passo se quiser fechar o funil inteiro.
- Os eventos só acumulam com alunos reais abrindo o app pós-deploy → rodar a query do funil daqui a alguns dias.

### Sessão 37 — Verificação de ativação + reativação dos trials que vencem hoje/amanhã

Objetivo: medir o nível de ativação dos trials e não perder os leads cuja janela vence agora.

#### Diagnóstico de ativação (snapshot 28/06 — 37 trials em `plan='free'`)
- **Sessão de treino executada pelo aluno = 0 em TODOS os 37.** Ninguém fechou o loop completo (aluno real → treino → aluno executa). É o gargalo de fundo.
- **Aluno real cadastrado: só 8 de 37** — Rodrigo Pereira, Luis Felipe, Jose Gustavo, Gustavo Fernandes, Glandeon, Edvaldo, Marco Túlio, Valdesandro. O resto vive no aluno demo ou em nada.
- Query de ativação por trainer: real/demo athletes + treinos + sessões + convites (LEFT JOINs em athletes/workouts/sessions/invites). Útil reusar.

#### Os 4 urgentes (venceu ontem / hoje / amanhã) — estados opostos
- **Janeto Lucas** (venceu 27/06): 1 demo, 2 treinos no demo, **0 aluno real** → explorou e travou no demo.
- **Eduardo** (`eduardo.espacoideal`, vencia 28/06): 0 de tudo — tire-kicker.
- **Jociel Ferreira** (vencia 29/06): 0 de tudo — tire-kicker.
- **Rodrigo Pereira** (vencia 29/06): **ATIVADO** — 1 aluno real + 1 treino + 5 convites; só falta o aluno entrar/treinar. **Caso mais quente da base** (follow-up de maior ROI = reenviar convite).

#### Ações executadas
- **Trial dos 4 estendido para 05/07** (`trial_ends_at = '2026-07-05 23:59:59-03'`) — folga antes do paywall, mesmo padrão da sessão 36. **Decisões da usuária:** incluir Janeto (já vencido) e estender antes de enviar.
- **E-mail de ativação 1:1 segmentado por estágio** (3 variantes), regras de copy fixas (self-service, sem persona de fundadora, sem call, assinado "Equipe Kinevia", CTA → login):
  - **Variante A** (frio, 0 alunos): Eduardo, Jociel — "cadastre seu primeiro aluno (ou aluno de teste)".
  - **Variante B** (explorou demo, sem aluno real): Janeto — "cadastre seu primeiro aluno real".
  - **Variante C** (ativado, aluno não entrou): Rodrigo — "reenvie o convite, falta o aluno entrar".
- **4/4 `sent`** via Resend `no-reply@kinevia.com.br` (reply_to `suporte@`), edge function descartável **`activation-blast`** (recipients/variantes hardcoded, guarda por token `kv-activation-2026-07-01`, `--no-verify-jwt`). Eventos gravados em `email_events`, campanha **`activation-2026-06`**. Eduardo sem nome no cadastro → saudação caiu no fallback "Personal".
- **Função neutralizada após o disparo** (re-deploy v2 inerte que responde 410; não há tool MCP de delete — apagar de vez pelo painel/CLI quando quiser).
- CSV de contatos atualizado na raiz (`trials_2026-06-28.csv`) com os novos vencimentos dos 4.

#### Follow-up agendado
- Lembrete para **01/07** (3 dias): conferir quais dos 4 reagiram (criaram aluno / executaram treino) antes do novo vencimento (05/07) — Rodrigo é prioridade (reenvio de convite).

### Sessão 36 — Verificação de pagantes + reativação dos trials vencidos

Objetivo: saber se há algum pagante e reativar quem estava vencendo.

#### Pagantes — diagnóstico
- **Zero pagantes confirmados.** `payment_logs` vazia e **nenhum trainer com `stripe_subscription_id`**.
- 2 contas `plan='pro'`: **Tatiana** (conta dona/teste) e **Marcos Matias Xavier** (`pro` **sem** Stripe nem `payment_logs` — **cortesia intencional**, confirmado).
- 4 trainers chegaram ao checkout (`stripe_customer_id`) mas **nenhum concluiu**: Robson Madeira, Glandeon Junior, Éder kan, Edvaldo Dias.

#### Reativação de trials vencidos / vencendo hoje
- Estendido `trial_ends_at` **+7 dias (→ 2026-07-03)** para os 4: **João Victor** (`jv.cavalcanti07`, venceu 24/06), **William Felipe**, **Rafael Bucatte**, **Luis Felipe** (`luisfelipedesaconsultoria`).
- Disparado e-mail de reativação 1:1 segmentado por ativação:
  - **Variante A** (criou conta, 0 alunos): João Victor, William, Rafael.
  - **Variante B** (já ativou — 1 aluno + 1 treino): Luis Felipe.
- **Decisões de copy (usuária):** sem persona de fundadora, sem "eu monto com você", sem call — é app self-service, assinado "Equipe Kinevia". CTA aponta pro **login** (`https://kinevia.com.br/login`).
- Envio via Resend `no-reply@kinevia.com.br` numa edge function **descartável** `reactivate-trial` (recipients/variantes hardcoded, guarda por token embutido, `--no-verify-jwt`), **deletada após o disparo**. 4/4 `sent`, eventos gravados em `email_events` campanha `reactivate-trial-2026-06`.
- **Nota:** João Victor é **conta de teste** (confirmado) — é um dos 3 UUIDs hardcoded como "sempre desconsiderar" nas métricas; entrou na leva por conveniência do disparo, mas nunca conta como conversão real.

#### Auditoria do Stripe — por que os 4 checkouts não converteram (INSIGHT)
Verificado direto na API do Stripe (modo **LIVE**) para os 4 customers: cada um tem **1 checkout session `expired`/`unpaid`** e **zero `payment_intents`, zero `charges`, zero `subscriptions`**. Conclusão técnica: **abandono puro antes de digitar o cartão** — não houve recusa de cartão, não houve falha de webhook, e **nada vazou** (ninguém foi cobrado sem registro; o `STRIPE_WEBHOOK_SECRET` nem foi exercitado).
- **Diagnóstico de produto (o que importa):** cruzando com ativação, **todos clicaram em "assinar" antes do "aha"**. Sessões de treino executadas = **0 em todos**; treinos montados = **0 em 3 de 4**. Caso a caso: **Éder** clicou sem cadastrar nada (tire-kicker); **Robson** só explorou o aluno demo; **Edvaldo** clicou em pagar *antes* de criar o aluno; **Glandeon** é o mais engajado (2 alunos reais + 5 convites) mas **nunca montou um treino**.
- **Tese:** o problema não é cartão nem preço — é **sequência**. O CTA de pagamento aparece cedo demais, antes do trainer montar+enviar o 1º treino e ver o aluno treinando. Reforça o **Tier 3** (drip segmentado: só empurrar venda pra quem já ativou) e sugere **esconder/segurar o CTA de assinar enquanto não houver 1º treino enviado**, trocando por "complete seu primeiro treino".
- **Ação:** email 1:1 de ativação enviado ao **Glandeon** (único genuinamente engajado que tentou pagar) — foco em "falta montar o primeiro treino", tom self-service, CTA → login. Campanha `nudge-workout-2026-06` (1/1 `sent`, registrado em `email_events`). Mesma mecânica da função descartável (deletada após o envio).

---

### Sessão 35 — Caixa de e-mail inbound (suporte@) + checklist de ativação + fix de entregabilidade

Objetivo: atacar o gargalo de ativação (lead cadastra mas não cria aluno real / não vira cliente) e avaliar a necessidade de uma caixa que **recebe** e-mails do Kinevia. Plano em tiers; executado o Tier 1 completo.

#### Diagnóstico (exploração do funil + infra de e-mail)
- **Sistema era 100% outbound, sem caixa que recebe.** Porém vários e-mails (`recovery`, `purchase-confirmed`, `announce-demo`, `check-billing`) usam `reply_to: suporte@kinevia.com.br` e têm CTA "Fale com a gente" → respostas de leads caíam em **buraco negro**. Decisão: não construir inbound no app; configurar caixa real monitorada com forward pro Gmail.
- Gargalo confirmado: trainer vê o aluno de demonstração (`is_demo`) como destino final e nunca cria aluno real (trava em `onboarding`, não chega em `athlete_created`).

#### Caixa de e-mail inbound — `suporte@kinevia.com.br` (ImprovMX → Gmail)
- **Zoho descartado** (removeram o "Forever Free" na maioria das regiões). Escolhido **ImprovMX** (encaminhamento grátis, DNS-agnóstico).
- DNS no **Registro.br**: 2 MX (`mx1`/`mx2.improvmx.com`, prio 10/20) + TXT SPF `v=spf1 include:spf.improvmx.com ~all`. Verificado via `Resolve-DnsName`: propagado, **sem conflito de SPF com o Resend** (raiz tinha só 1 registro spf).
- Aliases criados: **`suporte@`** e catch-all **`*@`** → `tatidpl@gmail.com`.
- **Armadilha resolvida:** os 2 primeiros testes bounçaram. (1) "Address not found" = alias ainda não existia; (2) "550 5.2.1 account disabled" = a **conta do ImprovMX precisava ser validada** (link no e-mail "Important: Validate your account"). Após validar, o forward funcionou — teste confirmado chegando no Gmail.

#### Fix de entregabilidade — `check-billing`
- A função de cobrança enviava de **`onboarding@resend.dev`** (sandbox do Resend, domínio compartilhado → alto risco de spam/bloqueio no e-mail que o personal mais precisa ver). Era a **única das 8 functions fora do padrão**.
- Corrigido para `from: 'Kinevia <no-reply@kinevia.com.br>'` + `reply_to: 'suporte@kinevia.com.br'`.
- **Deployado via MCP Supabase (v24 → v25)**, `verify_jwt: true` preservado (cron diário não quebra). Conteúdo no ar verificado.

#### Checklist de ativação — `DashboardPage.tsx` (homeView)
- Card **"Ative sua conta"** no topo da home, com 3 passos derivados de dados já em memória (sem fetch/migration novos): aluno real (`!is_demo`), primeiro treino p/ aluno real, aluno entrou no app (`auth_user_id`). Só o passo atual recebe a ação primária (accent); demais discretos. Some quando os 3 estão completos.
- **Reposiciona o aluno demo como exploração, não meta.** Consts derivadas + JSX declarados antes das views (zona segura de TDZ — mesma armadilha que derrubou produção na sessão 30).
- Novo evento **`activation_checklist_click`** (`{ step }`) em `analytics.ts` / `page_events` para medir impacto no `/trial/stats` nos próximos dias.

#### Git / Deploy
- 1 commit em `master` (`eebe791`) com os 3 arquivos (analytics, DashboardPage, check-billing), pushado pra `origin/master` (`fitflow`).
- Deploy de produção via **Vercel CLI** (`vercel --prod`): `dpl_AvKDgbamq7bghQcpBCqC3SMURUBV`, READY, aliasado em **kinevia.com.br**. `tsc --noEmit` limpo antes de subir.
- Os `.zip`/`_sales_page_tmp/` na raiz ficaram fora do commit de propósito (material à parte).

### Sessão 34 — Snapshot de cadastros + 3º disparo do lembrete "aluno de teste"

Objetivo: recontar cadastros (excl. `tatidpl`, Marcos, João Victor), ver quem ativou aluno real vs aluno de teste, e re-engajar os não-ativados com o lembrete do aluno de teste.

#### Snapshot 17/06 (12 cadastros, excl. tatidpl/Marcos/João Victor)
- Base cresceu: `trainers` agora com **15 linhas** (12 + os 3 excluídos). 4 cadastros novos desde a sessão 33: **Guga Binotto** (16/06), **Leonardo Fernandes** (16/06), **João Pedro Molter** (16/06), **Pedro Erivelton** (17/06).
- **Com aluno real (2 → ~17%):** Luis Felipe (1 aluno) e Rodrigo Pereira (1 aluno + 1 demo — único caminho completo).
- **Criaram aluno de teste / demo (6):** Janeto Lucas, Rodrigo Pereira, Henrique, Leonardo Fernandes, João Pedro Molter, Pedro Erivelton.
- **Não criaram NENHUM aluno (5):** William Felipe, Rafael Bucatte, Eduardo (`eduardo.espacoideal`), Jociel Ferreira, Guga Binotto.
- Os 4 cadastros novos (16–17/06) já chegaram criando o aluno de teste (menos o Guga) — sinal de que o CTA do demo está pegando no onboarding. Gargalo segue em **converter demo → aluno real** (só Rodrigo fez).

#### 3º disparo do lembrete do aluno de teste (campanha `demo-reminder2-jun2026`)
- Público: os **5 que nunca criaram aluno** (real nem demo) — decisão da usuária via pergunta de targeting. Texto evergreen da `announce-demo` (assunto "Teste o Kinevia com um aluno de demonstração", título "Veja o Kinevia funcionando antes de cadastrar seu primeiro aluno", CTA "Criar meu aluno de teste").
- **Fadiga de email flagada antes do disparo:** William e Rafael já tinham recebido **3 campanhas de demo cada** (demo-announce, copa-demo, demo-reminder-jun2026) sem reagir. Decisão da usuária: **poupar os dois** e enviar só aos 3 menos saturados.
- **Enviado a 3/3 `ok`:** eduardo.espacoideal (`780c6fc0…`), jocielf48 (`da398b0f…`), gugabinotto (`7b3f3ff2…`). Guga era o único que nunca tinha recebido nada. Registrado: 3× `sent` em `email_events`, campanha `demo-reminder2-jun2026`.
- Detalhe: o "nome" do Eduardo no cadastro é o próprio email → saudação caiu no fallback "Olá, Personal" (guarda do `firstName()`).
- ⚠️ **`ANNOUNCE_TOKEN` rotacionado de novo** (valor anterior não-recuperável). Sempre redefinir o secret antes de reusar a função.

#### Infra/ambiente
- **O MCP do Supabase passou a autenticar neste ambiente** (antes dava `Unrecognized client_id`). Snapshot e verificação do `email_events` foram feitos via `execute_sql` do MCP direto, sem precisar da função security definer + anon key. Disparo do email seguiu pelo CLI (`supabase.exe secrets set` + invoke REST) porque não há tool MCP para setar secret/invocar função.

#### Reformulação da `/trial/stats` (gráfico de cadastros + ativação por tipo de aluno)
- **Gráfico de cadastros desde 10/06**: novo combo chart SVG hand-rolled em `TrialStatsPage.tsx` (componente `SignupsChart`) — barras = cadastros por dia, linha dourada = total acumulado, com rótulos em cada ponto. Quadro no topo (abaixo dos KPIs) com o número grande de "cadastros no total".
- **RPC `signups_daily(p_since date)`** (migration `20260617000001_signups_daily.sql`): cadastros por dia em fuso `America/Sao_Paulo`, dias vazios preenchidos com `generate_series`, security definer, só agregados (granted a anon). **Exclui SEMPRE 3 UUIDs hardcoded** — Tatiana `6bff0f76…`, Marcos `72ab42b4…`, João Victor `861b14c0…`. Baseline real antes de 10/06 = 0, então o acumulado da janela é o total real (sequência: 0,4,4,5,8,9,12).
- ⚠️ **`João Pedro Molter` (`joaomolter`) NÃO é o João Victor** — fica DENTRO das métricas. Só os 3 UUIDs acima são excluídos.
- **Cards de ativação por tipo de aluno** abaixo do gráfico, via **RPC `signups_activation(p_since date)`** (migration `20260617000002_signups_activation.sql`, mesmo padrão agregado/security definer/exclusão dos 3): Ativaram aluno real, Ativaram aluno de teste (demo), Ativaram algum aluno, Sem nenhum aluno. Snapshot 17/06: **2 real / 6 demo / 7 qualquer / 5 nenhum** (de 12). 2+6 ≠ 7 porque o Rodrigo tem real E demo.
- **Card "Campanha de email — Aluno de teste" removido** da página (estado `campaign` + fetch `campaign_funnel` retirados). A RPC `campaign_funnel`/tabela `email_events` continuam no banco, só saíram da UI.
- 2 commits em `master` (`0241ced` gráfico + remoção do card; `bb8af69` cards de ativação). Migrations aplicadas via MCP `apply_migration`; `tsc --noEmit` limpo, build de produção ok.

### Sessão 33 — Snapshot de cadastros + 2º disparo do lembrete "aluno de teste"

Objetivo: contar cadastros (excl. `tatidpl`, Marcos, João Victor), ver quem tem alunos e quem usa o aluno de teste; depois re-engajar os não-ativados.

#### Snapshot 15/06 (8 cadastros, excl. tatidpl/Marcos/João Victor)
- **Com aluno real (2):** Luis Felipe (1 aluno) e Rodrigo Pereira (1 aluno + 1 demo — único que fez o caminho completo).
- **Usando aluno de teste / demo (3):** Janeto Lucas, Rodrigo Pereira, Henrique.
- **Não-ativados (0 aluno real):** William Felipe, Rafael Bucatte, Janeto Lucas, Eduardo (`eduardo.espacoideal`), Jociel Ferreira, Henrique.
- Cadastros novos desde a sessão 32: Jociel Ferreira (14/06), Rodrigo Pereira (14/06), Henrique (15/06). Ativação segue em ~25% — gargalo é "criar primeiro aluno".

#### 2º disparo do lembrete do aluno de teste (campanha `demo-reminder-jun2026`)
- Enviado via `announce-demo` (template **evergreen** já commitado em `f64451f`, sessão 32 — assunto "Teste o Kinevia com um aluno de demonstração", CTA "Criar meu aluno de teste"). Nada de Copa.
- **Destinatários (4, todos `ok`):** felipewilliam3, rafaelbucatte, eduardo.espacoideal, jocielf48. Decisão da usuária: incluir William e Rafael mesmo já tendo recebido o disparo `copa-demo` (sessão 32). Não incluídos Janeto/Henrique (já criaram o aluno de teste).
- Registrado no funil: 4× `sent` em `email_events`, campanha `demo-reminder-jun2026`.
- ⚠️ **`ANNOUNCE_TOKEN` foi rotacionado de novo** (valor anterior não-recuperável). Sempre que reusar a função, redefinir o secret antes de disparar.
- Redeploy da `announce-demo` (v9→v10): conteúdo idêntico ao commitado (evergreen), só pra garantir o ambiente — não houve mudança de código a commitar.


### Sessão 32 — Campanha de email "Copa" (aluno de teste) + diagnóstico do tracking de abertura/clique

Objetivo: re-engajar treinadores não-ativados com um lembrete do aluno de teste usando o gancho da Copa do Mundo, e entender por que o card de campanha do /trial/stats não mostra abertura/clique.

#### Cadastros (snapshot 14/06)
- **1 cadastro novo** desde a sessão 31: `eduardo.espacoideal@gmail.com` (13/06 19:09). Personal real (nenhum convite aceito coincide com o horário — não é órfã), mas travou no estágio 1 (0 alunos).
- Base atual: 9 linhas em `trainers` = 7 personais reais + você (`tatidpl`) + 1 órfã (`luisfelipsa`, segue na base; fix da sessão 31 só barra inserts novos).
- `/trial/stats` mostra "7" = janela de 7 dias da `validation_activation`, já incluindo o Eduardo (e ainda inflada pela órfã `luisfelipsa`). Reais na janela = 6, sendo 1 ativado.
- **Ativados (têm aluno real, não-demo):** Marcos (Marcos Cabral, Luiza Melucci) e Luis Felipe (LF teste). Os demais reais têm 0 alunos.

#### Campanha de email `copa-demo`
- Reaproveitada a edge function `announce-demo` (guarda por `ANNOUNCE_TOKEN`, deploy `--no-verify-jwt`). Editado `index.ts`: gancho da Copa no topo (Brasil 1×1 Marrocos, fase de grupos) + metáfora "aquecimento antes de escalar o time titular"; assunto novo "Brasil 1×1 — e o seu treino já pode entrar em campo"; **`reply_to: suporte@kinevia.com.br`** (o `from` segue `no-reply`, que só envia — frase "responda este e-mail" agora vai pra caixa real); guarda em `firstName()` contra "nome" que é email (caso do Eduardo → vira "Personal").
- `ANNOUNCE_TOKEN` foi **redefinido** (valor antigo não era recuperável, só digest) para disparar; é só trava manual, sem impacto em produção.
- **Enviado para os 5 não-ativados:** jv.cavalcanti07, felipewilliam3, rafaelbucatte, janetolm3, eduardo.espacoideal. Tag `copa-demo`. 5/5 ok. Não enviado a Marcos/Luis Felipe (ativados), `tatidpl` nem à órfã `luisfelipsa`.
- ⚠️ **Código de `announce-demo/index.ts` foi alterado e deployado, mas NÃO commitado.** Texto da Copa está hard-coded — reverter/parametrizar antes de reusar a função pra outra campanha.

#### Diagnóstico: tracking de abertura/clique não funciona (e por quê)
- `campaign_funnel('demo-announce')` e `('copa-demo')` ambos com **0 abertos / 0 cliques**. Na tabela `email_events` **só existem eventos `sent`** (gravados inline pela própria `announce-demo`) — nenhum `delivered/opened/clicked` jamais entrou.
- A função `resend-webhook` está **saudável e no ar** (GET→405, POST sem assinatura→401, ou seja `RESEND_WEBHOOK_SECRET` setado e validando). O problema é no **lado do Resend**: webhook nunca entregou evento.
- **Causa confirmada via doc do Resend:** open/click tracking **exige um subdomínio de tracking + CNAME verificado** (`tracking_subdomain`, ex. `links.kinevia.com.br` → `linksN.resend-dns.com`). Sem isso, o Resend nem gera os eventos. É config **no nível do domínio** (vale pra todos os emails, inclusive transacionais), tudo-ou-nada por flag.
- **Decisão: adiado.** Usuária optou por não configurar agora. Quando retomar: ligar **só `open_tracking`** (pixel, risco zero pros transacionais) via `PATCH /domains/{id}` `{"open_tracking":true,"tracking_subdomain":"links"}`, adicionar o CNAME no DNS de `kinevia.com.br`, e `POST /domains/{id}/verify`. Click tracking reescreveria links transacionais (reset de senha, convite, checkout) — só ligar se quiser mesmo medir clique.
- Nota: tracking não é retroativo — os emails `copa-demo` já enviados não serão rastreáveis; só vale pra envios futuros.
- A `RESEND_API_KEY` **não está no env local** (só `VITE_SUPABASE_*` no `.env`); existe apenas como secret do Supabase (valor não-recuperável). Fonte: painel Resend → API Keys (ou criar nova key, o que NÃO afeta as existentes).

#### Pendências abertas desta sessão
- ✅ Resolvido: texto da Copa revertido pro genérico em `announce-demo/index.ts` (mantidos `reply_to` e guarda do nome-email), função redeployada e commitada (`f64451f`, pushada em `master`).
- Configurar open tracking no Resend quando quiser medir abertura de campanha (passo a passo acima).
- Opcional: apontar o card de campanha do `/trial/stats` (hoje fixo em `'demo-announce'`, `TrialStatsPage.tsx:217`) para `'copa-demo'` ou torná-lo selecionável.
- ✅ Resolvido: linha fantasma `luisfelipsa` (`a34fa8ae`) removida de `trainers`. Era o aluno "LF teste" do Luis Felipe (auth `role=athlete`, 0 alunos/treinos/eventos) — só a linha de `trainers` foi apagada; o login (`auth.users`) e o athlete vinculado continuam intactos. `trainers` agora com 8 linhas (7 reais + `tatidpl`).

### Sessão 31 — Tracking do funil de ativação in-app + fix da conta órfã na raiz

Objetivo: responder "onde os cadastros travam" com dado real (hoje só dava pra inferir pela trilha athletes/invites/workouts) e corrigir a causa raiz da conta órfã que infla a contagem de cadastros.

#### Diagnóstico do dia (reconstrução do funil por trilha de dados)
- Dos cadastros recentes, **4 travaram no estágio 1** (Janeto, Rafael, William, João Victor: 0 alunos, 0 convites, 0 treinos — nunca passaram do "criar primeiro aluno")
- **Luis Felipe (`luisfelipedesaconsultoria`) ativou 100%** em 11/06: conta → aluno → convite aceito → treino `ready`
- O `luisfelipsa@gmail.com` que parecia cadastro duplicado **não é personal real**: é conta órfã criada quando o aluno do Luis Felipe aceitou o convite. Base tem **7 personais reais, não 8**
- Sintoma de UI no convite: Luis Felipe clicou "gerar convite" ~13× em 14s pro mesmo aluno (botão sem feedback)

#### Instrumentação do funil de ativação in-app
- Migration `20260613000001_page_events_user_id.sql`: coluna `page_events.user_id uuid` (nullable, sem FK; landing /trial continua null)
- `src/lib/analytics.ts`: `track()` ganhou 3º param `userId` (call sites in-app passam `trainer.id` do authStore; **nunca** chamar `auth.getUser()` dentro de track por causa do deadlock do onAuthStateChange). 7 eventos novos: `app_onboarding_view`, `create_athlete_opened`, `athlete_created`, `invite_generated`, `invite_copied`, `workout_started`, `workout_created`
- `src/pages/trainer/DashboardPage.tsx`: eventos "opened/started" via useEffect (`showAddAthlete`, `view==='recording'`); eventos de sucesso dentro dos handlers
- Migration `20260613000002_activation_funnel.sql`: RPC `activation_funnel(p_days)` security definer (zero PII, mesmo padrão de `validation_activation`) — conta trainers distintos por etapa. Ler via REST `/rpc/activation_funnel` body `{"p_days":N}`
- **Decisão de escopo (validação): sem card no /trial/stats** — leitura ad-hoc primeiro, construir UI só depois do dado provar valor. Eventos começam em 0 até o deploy concluir + uso

#### Fix da conta órfã na raiz
- Causa: a guarda `if role='athlete' then return` em `handle_new_trainer()` (trigger `on_auth_user_created`) foi adicionada em `20260410000001` mas **removida sem querer em `20260604000001_stripe_plans.sql`** ao reescrever a função pro trial. Desde 04/06 todo atleta que aceita convite (signUp `role='athlete'`) ganha linha fantasma em `trainers`
- Migration `20260613000003_fix_handle_new_trainer_athlete_guard.sql`: re-adiciona a guarda + preserva o trial. Verificado seguro nos 3 fluxos (personal sem role → cria; atleta com role → não cria; demo nem passa pelo trigger). Só afeta inserts NOVOS em auth.users

#### Git
- 2 commits em `master` pushados: `dcee15a` (tracking) + `a9b5a92` (fix da órfã). Migrations aplicadas no banco via `supabase.exe db push`; `tsc --noEmit` limpo

### Sessão 30 — Aluno de teste (demo) para ativação + fix de crash na edição de exercício

Objetivo: atacar o gargalo de ativação (treinadores entram e não cadastram aluno) deixando o cara explorar o produto em 1 clique, antes de ter aluno real.

#### Aluno de teste (demo)
- Migration `20260612000001_demo_athletes.sql`: coluna `athletes.is_demo boolean default false` + recriação de `validation_activation` adicionando `where not a.is_demo` nas duas subqueries — o demo **não conta** nas métricas de ativação da `/trial/stats` (senão inflaria justamente o KPI medido)
- `createDemoAthlete()` em `api.ts`: cria aluno `is_demo` "Aluno Exemplo" (sem convite) + "Treino A — Full Body" com 4 exercícios, buscando **vídeo real do YouTube** por exercício (mesmo `searchExerciseVideo` do fluxo normal); guarda anti-duplicado (reaproveita demo existente)
- `deleteAthlete()` em `api.ts`: exclusão simples; FKs de workouts/sessions/badges têm `on delete cascade`
- CTA "Criar aluno de teste" aparece **só quando o treinador não tem alunos** (`athletes.length === 0`) — card grande no Dashboard (home) + botão no estado vazio da aba Alunos. Card do demo tem selo TESTE e botão "Remover aluno de teste"
- Tipo `Athlete` ganhou `is_demo: boolean`

#### Fix de crash — edição de exercício (afetava todos os treinadores em produção)
- Bug de **TDZ**: `nameSuggestions` era usado na linha do form de edição da aba Treinos mas declarado ~200 linhas abaixo (antes da REVIEW VIEW). Como o bloco só renderiza ao clicar "Editar", o `ReferenceError: Cannot access 'nameSuggestions' before initialization` derrubava o app inteiro (tela preta) **para qualquer treinador**, não só o demo
- Correção: `allLibraryNames`/`nameSuggestions` movidos para antes das views (após os handlers)

#### Detalhe do aluno — exercícios clicáveis (editar + vídeo)
- Antes os exercícios no detalhe do aluno eram só leitura. Novo helper `renderAthleteDetailExercise` (usado nos treinos em programa e avulsos): cada exercício tem botão **Editar** (form inline: nome, séries, reps, carga, descanso, notas, reusa `handleSaveExercise`) e botão **Vídeo** (embed do YouTube inline)
- `handleSaveExercise` passou a atualizar também `athleteDetailWorkoutExercises` para refletir a edição na hora

#### Ícone de Cobranças
- Sino → **cifrão em círculo** ($) no header mobile e na sidebar (o botão sempre levou a `setView('billing')`); contador vermelho de pendentes mantido; ícone do header aumentado para 22px

#### Diagnóstico que virou nada
- "Mojibake" suspeito nas notas do demo era **artefato de medição** (`python -m json.tool` lendo UTF-8 como cp1252 no Windows) — dados sempre estiveram corretos no banco. Sem correção necessária

#### Campanha de email "Aluno de teste" + tracking
- Email disparado para os **5 treinadores não-ativados** (joao victor, William, Rafael, Janeto, Luis Felipe) via nova edge function `announce-demo` (Resend, remetente `no-reply@kinevia.com.br`, CTA → `/trainer`). Não enviado a Marcos (já ativo), à conta `tatidpl`, à duplicata `luisfelipsa` nem às contas Bienporte. Função protegida por secret `ANNOUNCE_TOKEN`, deploy `--no-verify-jwt`
- Tracking de campanha no `/trial/stats`: migration `20260612000002_email_tracking.sql` (tabela `email_events` sem select para anon + RPC agregado `campaign_funnel(text)` security definer); edge function `resend-webhook` (valida assinatura Svix via `RESEND_WEBHOOK_SECRET`, grava opened/clicked com `SR_KEY`); `announce-demo` marca `tags.campaign` e grava o `sent`. Card "Campanha de email — Aluno de teste" na página: Enviados / Abriram / Clicaram / Criaram aluno de teste
- **Open/click tracking não ativado**: o Resend exige subdomínio de tracking (CNAME no Registro.br) e abertura é imprecisa — decisão de **pular** e ficar com Enviados + Conversão (conversão vem do banco, é o sinal que importa). Webhook já está deployado e verificando assinatura, pronto pra ligar depois se quiser
- Baseline pós-envio: `sent=5, opened=0, clicked=0, created_demo=0`

- Deploy em produção ✓ (commits `f94010d` + tracking; `kinevia.com.br` HTTP 200)

---

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

- **Limpar contas órfãs antigas**: o fix da sessão 31 impede novas, mas linhas órfãs pré-13/06 (ex.: `luisfelipsa@gmail.com`) continuam em `trainers` inflando a contagem. Fazer scan e remover com segurança (verificar que não têm alunos/treinos reais vinculados)
- **Ler o funil de ativação**: daqui a alguns dias (após deploy + uso) chamar `activation_funnel(p_days)` via REST e ver onde o funil despenca de verdade
- **Stripe livemode**: testar fluxo completo com cartão real (até agora testado apenas com `sk_test_`)
- **Emails — verificar CTA**: link dos emails corrigido de `/planos` para `/trainer`; confirmar que botão leva ao checkout corretamente com trainer em trial real

---

## Backlog

- **Remover sistema de convite antigo**: rota `/invite/:token`, `InvitePage.tsx`, campo `athletes.invite_token` e helpers associados (`getAthleteByInviteToken`, `linkAthleteAccount`, `pending_invite_token` no App.tsx). Ninguém mais gera esses links desde a sessão 28; é código morto que causou o bug do link inválido por confusão entre os dois sistemas
- **Automatizar gasto de anúncios (opcional)**: a sessão 29 entregou a versão manual (tabela `ad_spend` + cards de custo na `/trial/stats`). Para automatizar, plugar uma Edge Function que puxe gasto/CPM/cliques/CTR da Meta Marketing API e faça upsert em `ad_spend` (token seguro no servidor via secret + cron diário, padrão check-billing). Pré-requisitos: Ad Account ID (`act_XXXXXXXXX`) e token com `ads_read` — obtenção do token travou no Graph API Explorer (permissões do app), reavaliar se/quando o volume justificar.
- Integração WhatsApp para notificações de cobrança
- Auto-completar programa via trigger já implementado — validar em produção com dados reais
