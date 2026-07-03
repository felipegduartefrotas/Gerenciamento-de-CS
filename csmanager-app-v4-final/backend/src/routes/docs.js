const express = require('express');
const pool = require('../db/pool');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// Lista documentos de um cliente (sem base64 para não sobrecarregar)
router.get('/', async (req, res) => {
  const { cliente_id } = req.query;
  if (!cliente_id) return res.status(400).json({ erro: 'Informe cliente_id.' });
  const { rows } = await pool.query(
    `SELECT id, cliente_id, nome, categoria, tamanho_kb, tipo, data_doc, nota, criado_em
     FROM documentos WHERE cliente_id = $1 ORDER BY criado_em DESC`,
    [cliente_id]
  );
  res.json(rows);
});

// Salva documento (base64) vinculado a um cliente
router.post('/', async (req, res) => {
  const { cliente_id, nome, categoria, tamanho_kb, tipo, base64, data_doc, nota } = req.body;
  if (!cliente_id || !base64) return res.status(400).json({ erro: 'cliente_id e base64 são obrigatórios.' });
  const { rows } = await pool.query(
    `INSERT INTO documentos (cliente_id, nome, categoria, tamanho_kb, tipo, data_base64, data_doc, nota)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, cliente_id, nome, categoria, tamanho_kb, tipo, data_doc, nota, criado_em`,
    [cliente_id, nome || null, categoria || null, tamanho_kb || null, tipo || null, base64, data_doc || null, nota || null]
  );
  res.status(201).json(rows[0]);
});

// Busca documento completo (com base64) para download
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM documentos WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ erro: 'Documento não encontrado.' });
  res.json(rows[0]);
});

// Exclui documento
router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query('DELETE FROM documentos WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows.length) return res.status(404).json({ erro: 'Documento não encontrado.' });
  res.json({ ok: true });
});

module.exports = router;
