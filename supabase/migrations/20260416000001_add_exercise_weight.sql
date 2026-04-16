-- Adiciona campo de peso prescrito aos exercícios
-- Nullable: nem todo exercício tem peso definido pelo trainer
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS weight_kg NUMERIC;
