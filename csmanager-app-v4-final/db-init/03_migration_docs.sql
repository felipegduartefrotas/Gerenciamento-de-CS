-- Migration: cria tabela de documentos (rodar uma vez em banco já existente)
CREATE TABLE IF NOT EXISTS documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome TEXT,
  categoria TEXT,
  tamanho_kb INT,
  tipo TEXT,
  data_base64 TEXT NOT NULL,
  data_doc TEXT,
  nota TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documentos_cliente ON documentos(cliente_id);
