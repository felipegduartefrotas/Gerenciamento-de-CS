const express = require('express');
const pool = require('../db/pool');
const { autenticar, exigirAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar, exigirAdmin);

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT chave, valor FROM configuracoes');
  const cfg = {};
  rows.forEach(r => { cfg[r.chave] = r.valor; });
  res.json(cfg);
});

router.put('/', async (req, res) => {
  const entradas = Object.entries(req.body || {});
  if (!entradas.length) return res.json({ ok: true });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [chave, valor] of entradas) {
      await client.query(
        `INSERT INTO configuracoes (chave, valor) VALUES ($1, $2)
         ON CONFLICT (chave) DO UPDATE SET valor = $2`,
        [chave, JSON.stringify(valor)]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Erro ao salvar configurações:', e);
    res.status(500).json({ erro: 'Erro ao salvar configurações.' });
  } finally {
    client.release();
  }
});

module.exports = router;
