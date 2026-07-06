-- ============================================================
-- Seed inicial — usuário admin padrão
-- IMPORTANTE: troque a senha pelo painel de configurações
--             assim que o sistema subir pela primeira vez!
-- ============================================================

INSERT INTO usuarios (nome, email, senha_hash, papel)
VALUES (
  'Felipe Duarte',
  'felipe.duarte@crearesistemas.com.br',
  '$2b$10$hLYBSl.55ADWkyr8qglzKOvXvjSptqRwCJqV/cKElE8XqTvhaaDUG',
  'admin'
)
ON CONFLICT (email) DO NOTHING;

-- Configurações padrão de alertas (equivalente ao "config" do localStorage)
INSERT INTO configuracoes (chave, valor) VALUES
  ('alertaDiasSemContato', '30'),
  ('alertaHSMinimo', '50'),
  ('alertaNPSMinimo', '20'),
  ('alertaDiasRenovacao', '60'),
  ('webhookUrl', '')
ON CONFLICT (chave) DO NOTHING;
