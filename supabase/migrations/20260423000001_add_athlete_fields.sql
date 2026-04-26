-- Adiciona campos opcionais ao atleta: telefone e peso
-- email passa a ser nullable (telefone pode substituir como canal de contato)

ALTER TABLE public.athletes ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS weight_kg numeric;
