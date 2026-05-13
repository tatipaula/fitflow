-- Billing fields on athletes
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS billing_day    integer      CHECK (billing_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS billing_amount numeric(10,2);

-- Pix key on trainers
ALTER TABLE trainers
  ADD COLUMN IF NOT EXISTS pix_key text;

-- Push subscriptions (one per device per user)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL,
  role       text        NOT NULL CHECK (role IN ('trainer', 'athlete')),
  endpoint   text        NOT NULL,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_owns_push_sub" ON push_subscriptions
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
