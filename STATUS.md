# Kinevia — Status

## Última atualização: 2026-05-03

---

## Concluído

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
  - Exibe valor e chave Pix do personal
  - Desaparece após o atleta tocar "Paguei ✓"
- Sininho com badge no header do trainer (mobile) e sidebar (desktop)
  - Badge mostra quantos atletas têm mensalidade pendente
  - Clicar navega direto para a view de Alunos
- Status de cobrança nos cards dos atletas: "Mensalidade pendente" (âmbar) ou "Pago em DD/MM" (verde)
- Funções `isBillingDue` e `confirmPayment` exportadas de `src/lib/api.ts`
- Deploy em produção ✓

---

## Pendências imediatas

### Testar notificações in-app end-to-end
1. Logar como atleta → verificar se o banner de mensalidade aparece
2. Tocar "Paguei ✓" → verificar se o banner some
3. Logar como trainer → verificar sininho com badge e status nos cards

---

## Backlog

- **Sprint 5**: Gamificação / ranking entre atletas
- **Sprint 6**: Métricas comparáveis (evolução de cargas, frequência)
- **Sprint 7**: Integração WhatsApp para notificações de cobrança
- Verificação de domínio no Resend (hoje usa `onboarding@resend.dev`)
- Stripe: definir canal de pagamento e implementar
