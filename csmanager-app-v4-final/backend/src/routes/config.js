const express = require('express');
const pool = require('../db/pool');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT chave, valor FROM configuracoes');
  const cfg = {};
  rows.forEach(r => { cfg[r.chave] = r.valor; });
  res.json(cfg);
});

router.put('/', async (req, res) => {
  const entradas = Object.entries(req.body || {});
  for (const [chave, valor] of entradas) {
    await pool.query(
      `INSERT INTO configuracoes (chave, valor) VALUES ($1, $2)
       ON CONFLICT (chave) DO UPDATE SET valor = $2`,
      [chave, JSON.stringify(valor)]
    );
  }
  res.json({ ok: true });
});

module.exports = router;
