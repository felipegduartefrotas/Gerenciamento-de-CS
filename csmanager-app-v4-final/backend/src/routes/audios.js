const express = require('express');
const pool = require('../db/pool');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

router.post('/', async (req, res) => {
  const { cliente_id, data_base64, duracao, tamanho_kb } = req.body;
  if (!cliente_id || !data_base64) return res.status(400).json({ erro: 'cliente_id e data_base64 são obrigatórios.' });
  const { rows } = await pool.query(
    `INSERT INTO audios (cliente_id, data_base64, duracao, tamanho_kb) VALUES ($1,$2,$3,$4) RETURNING id, cliente_id, duracao, tamanho_kb, criado_em`,
    [cliente_id, data_base64, duracao, tamanho_kb]
  );
  res.status(201).json(rows[0]);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM audios WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ erro: 'Áudio não encontrado.' });
  res.json(rows[0]);
});

module.exports = router;
