-- Registra a última confirmação de pagamento pelo próprio atleta
alter table public.athletes
  add column if not exists last_paid_at date;

-- Atleta pode atualizar last_paid_at na própria linha
create policy "athlete can confirm own payment"
  on public.athletes for update
  using  (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);
