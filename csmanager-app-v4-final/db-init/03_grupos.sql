-- ============================================================
-- CS Manager — Grupos Econômicos
-- Migration: adiciona suporte a matriz/filial
-- ============================================================

CREATE TABLE grupos_economicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS grupo_id UUID REFERENCES grupos_economicos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_no_grupo TEXT CHECK (tipo_no_grupo IN ('matriz','filial'));

CREATE INDEX IF NOT EXISTS idx_clientes_grupo ON clientes(grupo_id);
