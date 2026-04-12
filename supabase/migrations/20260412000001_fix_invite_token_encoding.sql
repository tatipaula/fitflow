-- Fix: encode() não suporta 'base64url' e gen_random_bytes requer pgcrypto.
-- gen_random_uuid() é nativo no PostgreSQL 13+ e gera token URL-safe sem extensão.
ALTER TABLE public.athletes
  ALTER COLUMN invite_token
  SET DEFAULT replace(gen_random_uuid()::text, '-', '');
