const express = require('express');
const pool = require('../db/pool');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// Lista audios por cliente ou por reunião (sem data_base64 para não sobrecarregar)
router.get('/', async (req, res) => {
  const { cliente_id, reuniao_id } = req.query;
  if (!cliente_id && !reuniao_id) return res.status(400).json({ erro: 'Informe cliente_id ou reuniao_id.' });
  const col = cliente_id ? 'cliente_id' : 'reuniao_id';
  const val = cliente_id || reuniao_id;
  const { rows } = await pool.query(
    `SELECT id, cliente_id, reuniao_id, titulo, duracao, tamanho_kb, criado_em
     FROM audios WHERE ${col} = $1 ORDER BY criado_em DESC`,
    [val]
  );
  res.json(rows);
});

// Salva áudio (base64) vinculado a um cliente e opcionalmente a uma reunião
router.post('/', async (req, res) => {
  const { cliente_id, reuniao_id, titulo, data_base64, duracao, tamanho_kb } = req.body;
  if (!cliente_id || !data_base64) return res.status(400).json({ erro: 'cliente_id e data_base64 são obrigatórios.' });
  const { rows } = await pool.query(
    `INSERT INTO audios (cliente_id, reuniao_id, titulo, data_base64, duracao, tamanho_kb)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, cliente_id, reuniao_id, titulo, duracao, tamanho_kb, criado_em`,
    [cliente_id, reuniao_id || null, titulo || null, data_base64, duracao, tamanho_kb]
  );
  res.status(201).json(rows[0]);
});

// Busca áudio completo (com data_base64) para reprodução
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM audios WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ erro: 'Áudio não encontrado.' });
  res.json(rows[0]);
});

// Exclui áudio
router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query('DELETE FROM audios WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows.length) return res.status(404).json({ erro: 'Áudio não encontrado.' });
  res.json({ ok: true });
});

module.exports = router;
