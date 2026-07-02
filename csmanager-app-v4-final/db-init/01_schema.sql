-- ============================================================
-- CS Manager Creare Sistemas — Schema PostgreSQL
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── USUÁRIOS (login real, papéis admin/consultor) ──────────────
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'consultor' CHECK (papel IN ('admin','gerencial','consultor')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── CLIENTES ─────────────────────────────────────────────────
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  natureza_juridica TEXT,
  porte TEXT,
  situacao_rf TEXT,
  data_abertura TEXT,
  cnae TEXT,
  segmento TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  regiao TEXT,
  contato TEXT,
  cargo TEXT,
  email TEXT,
  telefone TEXT,
  responsavel_cs TEXT,
  responsavel_comercial TEXT,
  tier TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  mensalidade_por_veiculo NUMERIC(12,2),
  taxa_adesao_por_veiculo NUMERIC(12,2),
  mrr TEXT,
  veiculos TEXT,
  inicio TEXT,
  data_assinatura TEXT,
  vigencia TEXT,
  produtos TEXT,
  health_score INT NOT NULL DEFAULT 70,
  ultimo_nps INT,
  data_renovacao TEXT,
  renovacao TEXT,
  ultima_alteracao_em TIMESTAMPTZ,
  ultima_alteracao_por TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ
);

-- ── REUNIÕES (realizadas) ───────────────────────────────────
CREATE TABLE reunioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo TEXT,
  data_iso TIMESTAMPTZ NOT NULL DEFAULT now(),
  csat INT,
  nps INT,
  sentimento TEXT,
  responsavel TEXT,
  participantes_creare JSONB DEFAULT '[]',
  participantes_cliente JSONB DEFAULT '[]',
  pontos_positivos TEXT,
  problemas_identificados TEXT,
  melhorias TEXT,
  proxima_reuniao TEXT,
  resumo_ia TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── AÇÕES (Kanban, inclui reuniões agendadas como categoria) ──
CREATE TABLE acoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  area TEXT,
  prioridade TEXT DEFAULT 'Média',
  status TEXT NOT NULL DEFAULT 'Pendente',
  progresso INT DEFAULT 0,
  responsavel TEXT,
  prazo TEXT,
  prazo_iso TIMESTAMPTZ,
  comentarios TEXT,
  categoria TEXT,
  reuniao_tipo TEXT,
  reuniao_data TEXT,
  reuniao_hora TEXT,
  reuniao_pauta TEXT,
  modalidade TEXT,
  reuniao_endereco TEXT,
  lat NUMERIC,
  lng NUMERIC,
  log JSONB DEFAULT '[]',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por TEXT,
  ultima_alteracao_em TIMESTAMPTZ,
  ultima_alteracao_por TEXT,
  concluido_em TIMESTAMPTZ
);

-- ── NPS ──────────────────────────────────────────────────────
CREATE TABLE nps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nota INT NOT NULL CHECK (nota BETWEEN 0 AND 10),
  respondente TEXT,
  cargo TEXT,
  comentario TEXT,
  data_iso TIMESTAMPTZ NOT NULL DEFAULT now(),
  cs TEXT
);

-- ── TIMELINE (auditoria por cliente, com histórico de edição) ─
CREATE TABLE timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT,
  descricao TEXT,
  usuario TEXT,
  data_iso TIMESTAMPTZ NOT NULL DEFAULT now(),
  editado BOOLEAN DEFAULT false,
  ultima_edicao_em TIMESTAMPTZ,
  historico JSONB DEFAULT '[]'
);

-- ── ONBOARDING ───────────────────────────────────────────────
CREATE TABLE onboardings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  escopo TEXT,
  etapas JSONB DEFAULT '[]',
  progresso INT DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── ALERTAS DISPENSADOS (controle de quais já foram tratados) ─
CREATE TABLE alertas_dismissed (
  alerta_id TEXT PRIMARY KEY,
  dispensado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── CONFIGURAÇÕES GERAIS (chave-valor, equivalente ao "config") ─
CREATE TABLE configuracoes (
  chave TEXT PRIMARY KEY,
  valor JSONB
);

-- ── ÁUDIOS ANEXADOS (base64 salvo no banco) ───────────────────
CREATE TABLE audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  data_base64 TEXT NOT NULL,
  duracao TEXT,
  tamanho_kb INT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── ÍNDICES ──────────────────────────────────────────────────
CREATE INDEX idx_reunioes_cliente ON reunioes(cliente_id);
CREATE INDEX idx_acoes_cliente ON acoes(cliente_id);
CREATE INDEX idx_acoes_status ON acoes(status);
CREATE INDEX idx_nps_cliente ON nps(cliente_id);
CREATE INDEX idx_timeline_cliente ON timeline(cliente_id);
CREATE INDEX idx_timeline_data ON timeline(data_iso DESC);
CREATE INDEX idx_clientes_status ON clientes(status);

-- Usados pela rota de alertas: ações atrasadas (status + prazo) e reuniões
-- agendadas (filtro por categoria). Sem esses índices, a consulta de alertas
-- faria uma varredura completa da tabela "acoes" a cada chamada, o que fica
-- progressivamente mais lento conforme a carteira de clientes cresce.
CREATE INDEX idx_acoes_categoria ON acoes(categoria);
CREATE INDEX idx_acoes_status_prazo ON acoes(status, prazo_iso);

-- Evita CNPJ duplicado entre clientes (índice único PARCIAL: ignora valores
-- vazios ou nulos, já que o cadastro e a importação por Excel permitem
-- deixar o CNPJ em branco temporariamente). Tentar salvar um CNPJ que já
-- existe em outro cliente vai gerar um erro de violação de unicidade.
CREATE UNIQUE INDEX idx_clientes_cnpj_unico ON clientes(cnpj) WHERE cnpj IS NOT NULL AND cnpj != '';
