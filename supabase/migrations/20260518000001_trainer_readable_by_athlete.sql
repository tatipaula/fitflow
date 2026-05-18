-- Allow athletes to read their own trainer's row (needed to show Pix key in billing banner)
CREATE POLICY "athlete: select own trainer"
ON trainers FOR SELECT
USING (
  id IN (
    SELECT trainer_id FROM athletes WHERE auth_user_id = auth.uid()
  )
);
