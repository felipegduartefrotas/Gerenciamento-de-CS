const express = require('express');
const pool = require('../db/pool');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// Retorna o histórico de HS de um cliente (últimos 60 registros)
router.get('/:clienteId', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT score, registrado_em
     FROM health_score_historico
     WHERE cliente_id = $1
     ORDER BY registrado_em ASC
     LIMIT 60`,
    [req.params.clienteId]
  );
  res.json(rows);
});

// Registra um snapshot manual de HS (chamado pelo frontend após salvar reunião/NPS)
router.post('/:clienteId', async (req, res) => {
  const { score } = req.body;
  if (score === undefined || score === null) {
    return res.status(400).json({ erro: 'Score é obrigatório.' });
  }
  const s = parseInt(score, 10);
  if (isNaN(s) || s < 0 || s > 100) {
    return res.status(400).json({ erro: 'Score deve ser um número entre 0 e 100.' });
  }

  // Só registra se o score mudou em relação ao último registro
  const { rows: ultimo } = await pool.query(
    `SELECT score FROM health_score_historico
     WHERE cliente_id = $1
     ORDER BY registrado_em DESC LIMIT 1`,
    [req.params.clienteId]
  );
  if (ultimo.length && ultimo[0].score === s) {
    return res.json({ ok: true, registrado: false });
  }

  await pool.query(
    'INSERT INTO health_score_historico (cliente_id, score) VALUES ($1, $2)',
    [req.params.clienteId, s]
  );
  res.json({ ok: true, registrado: true });
});

module.exports = router;
