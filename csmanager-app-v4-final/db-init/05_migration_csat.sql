-- Migration: tabela CSAT (para bancos existentes)
CREATE TABLE IF NOT EXISTS csat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nota INT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  tipo_interacao TEXT NOT NULL DEFAULT 'Geral',
  respondente TEXT,
  cargo TEXT,
  comentario TEXT,
  data_iso TIMESTAMPTZ NOT NULL DEFAULT now(),
  cs TEXT
);

CREATE INDEX IF NOT EXISTS idx_csat_cliente ON csat(cliente_id);
