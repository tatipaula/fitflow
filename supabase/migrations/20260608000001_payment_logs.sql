CREATE TABLE payment_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    uuid        NOT NULL REFERENCES athletes(id)  ON DELETE CASCADE,
  trainer_id    uuid        NOT NULL REFERENCES trainers(id)  ON DELETE CASCADE,
  paid_at       date        NOT NULL DEFAULT CURRENT_DATE,
  amount        numeric(10,2),
  confirmed_by  text        NOT NULL DEFAULT 'trainer'
                            CHECK (confirmed_by IN ('trainer', 'athlete')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;

-- Trainer gerencia logs dos seus alunos
CREATE POLICY "trainer_manage_payment_logs"
ON payment_logs FOR ALL
USING     (trainer_id = auth.uid())
WITH CHECK(trainer_id = auth.uid());

-- Aluno vê seus próprios logs
CREATE POLICY "athlete_select_own_payment_logs"
ON payment_logs FOR SELECT
USING (
  athlete_id IN (
    SELECT id FROM athletes WHERE auth_user_id = auth.uid()
  )
);

-- Aluno pode inserir seu próprio log (quando clica "Paguei ✓")
CREATE POLICY "athlete_insert_own_payment_logs"
ON payment_logs FOR INSERT
WITH CHECK (
  athlete_id IN (
    SELECT id FROM athletes WHERE auth_user_id = auth.uid()
  )
);

CREATE INDEX payment_logs_athlete_id_idx ON payment_logs (athlete_id, paid_at DESC);
