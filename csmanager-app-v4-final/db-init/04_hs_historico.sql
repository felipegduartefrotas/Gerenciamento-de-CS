-- ============================================================
-- Histórico de Health Score por cliente
-- Registrado automaticamente a cada atualização do cliente
-- ============================================================

CREATE TABLE IF NOT EXISTS health_score_historico (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  score       INTEGER     NOT NULL CHECK (score BETWEEN 0 AND 100),
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hs_hist_cliente
  ON health_score_historico(cliente_id, registrado_em DESC);
