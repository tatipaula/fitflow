-- ─── Programs ────────────────────────────────────────────────────────────────

CREATE TABLE programs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  duration_weeks integer NOT NULL DEFAULT 4,
  status         text NOT NULL DEFAULT 'upcoming'
                   CHECK (status IN ('active', 'upcoming', 'completed')),
  athlete_id     uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  trainer_id     uuid NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

-- Trainer lê/escreve seus próprios programas
CREATE POLICY "trainer_all_programs" ON programs
  FOR ALL
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

-- Atleta lê seus próprios programas (trainer_id != auth.uid(), mas athlete linkado)
CREATE POLICY "athlete_read_programs" ON programs
  FOR SELECT
  USING (
    athlete_id IN (
      SELECT id FROM athletes WHERE auth_user_id = auth.uid()
    )
  );

-- ─── Workouts: adicionar colunas de programa ──────────────────────────────────

ALTER TABLE workouts
  ADD COLUMN program_id    uuid REFERENCES programs(id) ON DELETE SET NULL,
  ADD COLUMN program_order integer;

-- ─── Trigger: auto-complete programa ─────────────────────────────────────────
-- Dispara após INSERT/UPDATE em sessions quando completed_at é preenchido.
-- Verifica se todos os workouts do programa têm ao menos uma sessão concluída.

CREATE OR REPLACE FUNCTION check_program_completion()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_program_id uuid;
  v_total      integer;
  v_done       integer;
BEGIN
  -- Só age quando completed_at acabou de ser preenchido
  IF NEW.completed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Descobre o programa do workout desta sessão
  SELECT w.program_id INTO v_program_id
  FROM workouts w
  WHERE w.id = NEW.workout_id;

  IF v_program_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Quantos workouts no programa
  SELECT COUNT(*) INTO v_total
  FROM workouts
  WHERE program_id = v_program_id;

  -- Quantos têm pelo menos uma sessão concluída
  SELECT COUNT(DISTINCT w.id) INTO v_done
  FROM workouts w
  JOIN sessions s ON s.workout_id = w.id
  WHERE w.program_id = v_program_id
    AND s.completed_at IS NOT NULL;

  IF v_total > 0 AND v_done >= v_total THEN
    UPDATE programs SET status = 'completed' WHERE id = v_program_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_program_completion
  AFTER INSERT OR UPDATE OF completed_at ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION check_program_completion();
