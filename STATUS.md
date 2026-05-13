# Kinevia — Status

## Última atualização: 2026-05-13

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

- **Domínio no Resend**: verificar `kinevia.com.br` e trocar remetente de `onboarding@resend.dev` para `no-reply@kinevia.com.br`

---

## Backlog

- Organização de treinos por dias da semana (estrutura a definir)
- Stripe: definir canal de pagamento (web vs app store) e implementar
- Métricas de evolução de cargas por exercício (histórico comparável)
- Integração WhatsApp para notificações de cobrança
