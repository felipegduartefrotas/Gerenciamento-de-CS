-- ============================================================
-- Seed inicial — usuário admin padrão
-- IMPORTANTE: troque esta senha no primeiro acesso!
-- ============================================================

INSERT INTO usuarios (nome, email, senha_hash, papel)
VALUES (
  'Felipe Duarte',
  'felipe@creare.com.br',
  '$2b$10$hLYBSl.55ADWkyr8qglzKOvXvjSptqRwCJqV/cKElE8XqTvhaaDUG', -- senha inicial: Creare2026!
  'admin'
)
ON CONFLICT (email) DO NOTHING;

-- Configurações padrão de alertas (equivalente ao "config" do localStorage)
INSERT INTO configuracoes (chave, valor) VALUES
  ('alertaDiasSemContato', '30'),
  ('alertaHSMinimo', '50'),
  ('alertaNPSMinimo', '20'),
  ('alertaDiasRenovacao', '60')
ON CONFLICT (chave) DO NOTHING;
