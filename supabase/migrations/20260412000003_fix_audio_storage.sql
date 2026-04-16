-- Garante que o bucket 'audio' existe e está público
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Remove políticas antigas se existirem (idempotente)
DROP POLICY IF EXISTS "trainers can upload audio" ON storage.objects;
DROP POLICY IF EXISTS "public can read audio" ON storage.objects;
DROP POLICY IF EXISTS "trainers can delete own audio" ON storage.objects;

-- Trainers autenticados podem fazer upload no bucket audio
CREATE POLICY "trainers can upload audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio'
  AND exists (
    SELECT 1 FROM public.trainers t WHERE t.id = auth.uid()
  )
);

-- Leitura pública (necessária para a Edge Function buscar o arquivo via URL pública)
CREATE POLICY "public can read audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio');

-- Trainers podem deletar seus próprios arquivos
CREATE POLICY "trainers can delete own audio"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'audio'
  AND exists (
    SELECT 1 FROM public.trainers t WHERE t.id = auth.uid()
  )
);
