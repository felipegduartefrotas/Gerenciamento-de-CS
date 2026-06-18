// Rota de armazenamento chave-valor genérico, usada por features cujo
// schema dedicado ainda não foi migrado (ex.: onboarding com estrutura
// de "steps" própria). Reaproveita a tabela `configuracoes` (JSONB).
// Pragmático: persiste de verdade no Postgres, compartilhado entre todos
// os usuários, sem precisar desenhar uma tabela dedicada agora.
const express = require('express');
const pool = require('../db/pool');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// Limites de segurança: evita que qualquer usuário autenticado consiga
// criar chaves arbitrárias em excesso ou gravar valores enormes na tabela
// de configurações (que não tem paginação nem limite de linhas).
const TAMANHO_MAX_CHAVE = 100;
const TAMANHO_MAX_VALOR_BYTES = 1024 * 1024; // 1MB — generoso para JSON de onboarding/config, mas com teto

function chaveValida(chave) {
  return typeof chave === 'string' && chave.length > 0 && chave.length <= TAMANHO_MAX_CHAVE && /^[a-zA-Z0-9_:-]+$/.test(chave);
}

router.get('/:chave', async (req, res) => {
  if (!chaveValida(req.params.chave)) return res.status(400).json({ erro: 'Chave inválida.' });
  const { rows } = await pool.query('SELECT valor FROM configuracoes WHERE chave = $1', [req.params.chave]);
  res.json(rows.length ? rows[0].valor : null);
});

router.put('/:chave', async (req, res) => {
  if (!chaveValida(req.params.chave)) return res.status(400).json({ erro: 'Chave inválida.' });
  const { valor } = req.body;
  const serializado = JSON.stringify(valor);
  if (Buffer.byteLength(serializado, 'utf8') > TAMANHO_MAX_VALOR_BYTES) {
    return res.status(413).json({ erro: 'Valor excede o tamanho máximo permitido (1MB).' });
  }
  await pool.query(
    `INSERT INTO configuracoes (chave, valor) VALUES ($1, $2)
     ON CONFLICT (chave) DO UPDATE SET valor = $2`,
    [req.params.chave, serializado]
  );
  res.json({ ok: true });
});

module.exports = router;
