-- PAR-Q: questionário de pré-atividade física
-- Respondido pelo atleta durante o onboarding via /convite/:token
-- has_any_yes é coluna gerada — qualquer "sim" recomenda avaliação médica

CREATE TABLE public.parq_responses (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id  uuid    NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  q1 boolean NOT NULL,
  q2 boolean NOT NULL,
  q3 boolean NOT NULL,
  q4 boolean NOT NULL,
  q5 boolean NOT NULL,
  q6 boolean NOT NULL,
  q7 boolean NOT NULL,
  has_any_yes boolean GENERATED ALWAYS AS (q1 OR q2 OR q3 OR q4 OR q5 OR q6 OR q7) STORED,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX parq_responses_athlete_id_idx ON public.parq_responses(athlete_id);

ALTER TABLE public.parq_responses ENABLE ROW LEVEL SECURITY;

-- Treinador vê respostas dos seus atletas
CREATE POLICY "trainer: view parq of own athletes"
  ON public.parq_responses FOR SELECT
  USING (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE trainer_id = auth.uid()
    )
  );

-- Atleta insere apenas para si mesmo
CREATE POLICY "athlete: insert own parq"
  ON public.parq_responses FOR INSERT
  WITH CHECK (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE auth_user_id = auth.uid()
    )
  );

-- Permite inserção anon para o caso de token pendente (email confirmado depois)
CREATE POLICY "service_role: insert parq"
  ON public.parq_responses FOR INSERT
  TO service_role
  WITH CHECK (true);
