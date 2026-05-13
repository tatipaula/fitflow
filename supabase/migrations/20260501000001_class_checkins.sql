-- Add session package tracking to athletes
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS sessions_total integer NOT NULL DEFAULT 0;

-- Class check-ins: trainer marks attendance for each in-person class
CREATE TABLE IF NOT EXISTS class_checkins (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id  uuid        NOT NULL REFERENCES trainers(id)  ON DELETE CASCADE,
  athlete_id  uuid        NOT NULL REFERENCES athletes(id)  ON DELETE CASCADE,
  checked_at  timestamptz NOT NULL DEFAULT now(),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE class_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer_owns_checkins" ON class_checkins
  FOR ALL USING (trainer_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_class_checkins_athlete ON class_checkins(athlete_id);
CREATE INDEX IF NOT EXISTS idx_class_checkins_trainer ON class_checkins(trainer_id);
