-- Tabela de convites com expiração de 7 dias
-- Permite telefone/email como canal; atleta é pré-criado antes de aceitar

CREATE TABLE public.invites (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid        NOT NULL REFERENCES public.trainers(id)  ON DELETE CASCADE,
  athlete_id uuid        NOT NULL REFERENCES public.athletes(id)  ON DELETE CASCADE,
  token      text        UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invites_token_idx      ON public.invites(token);
CREATE INDEX invites_trainer_id_idx ON public.invites(trainer_id);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Treinador gerencia seus próprios convites
CREATE POLICY "trainer: manage own invites"
  ON public.invites FOR ALL
  USING (trainer_id = auth.uid());

-- Leitura pública por token (necessário para a rota /convite/:token sem auth)
CREATE POLICY "public: read invite by token"
  ON public.invites FOR SELECT
  TO anon, authenticated
  USING (true);

-- RPC segura: vincula atleta ao auth.uid() usando o token do convite
CREATE OR REPLACE FUNCTION public.link_athlete_by_invite_token(p_invite_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM public.invites
  WHERE token = p_invite_token
    AND used_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.athletes
  SET auth_user_id = auth.uid()
  WHERE id = v_invite.athlete_id;

  UPDATE public.invites
  SET used_at = now()
  WHERE id = v_invite.id;

  RETURN true;
END;
$$;
