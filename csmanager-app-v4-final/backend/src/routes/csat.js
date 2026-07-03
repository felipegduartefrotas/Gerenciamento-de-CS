const express = require('express');
const pool = require('../db/pool');
const { autenticar } = require('../middleware/auth');
const { recalcularHealthScore } = require('./reunioes');

const router = express.Router();
router.use(autenticar);

function calcularCSAT(notas) {
  if (!notas.length) return { score: null, total: 0, satisfeitos: 0, satisfPct: 0, media: null };
  const satisfeitos = notas.filter(n => n >= 4).length;
  const total = notas.length;
  const score = Math.round((satisfeitos / total) * 100);
  const media = Math.round((notas.reduce((s, n) => s + n, 0) / total) * 10) / 10;
  return { score, total, satisfeitos, satisfPct: score, media };
}

// Lista todos (com nome do cliente)
router.get('/', async (req, res) => {
  const { cliente_id } = req.query;
  let query = `SELECT c.*, cl.empresa FROM csat c LEFT JOIN clientes cl ON cl.id = c.cliente_id`;
  const params = [];
  if (cliente_id) { query += ` WHERE c.cliente_id = $1`; params.push(cliente_id); }
  query += ` ORDER BY c.data_iso DESC`;
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// Score geral
router.get('/geral', async (req, res) => {
  const { rows } = await pool.query('SELECT nota FROM csat');
  res.json(calcularCSAT(rows.map(r => r.nota)));
});

// Por cliente
router.get('/cliente/:clienteId', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM csat WHERE cliente_id = $1 ORDER BY data_iso DESC',
    [req.params.clienteId]
  );
  res.json(rows);
});

router.get('/cliente/:clienteId/calculo', async (req, res) => {
  const { rows } = await pool.query('SELECT nota FROM csat WHERE cliente_id = $1', [req.params.clienteId]);
  res.json(calcularCSAT(rows.map(r => r.nota)));
});

// Registrar
router.post('/', async (req, res) => {
  const { cliente_id, nota, tipo_interacao, respondente, cargo, comentario } = req.body;
  if (!cliente_id || nota === undefined) return res.status(400).json({ erro: 'cliente_id e nota são obrigatórios.' });
  if (nota < 1 || nota > 5) return res.status(400).json({ erro: 'Nota CSAT deve ser entre 1 e 5.' });

  const { rows } = await pool.query(
    `INSERT INTO csat (cliente_id, nota, tipo_interacao, respondente, cargo, comentario, cs)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [cliente_id, nota, tipo_interacao || 'Geral', respondente || null, cargo || null, comentario || null, req.usuario.nome]
  );

  await recalcularHealthScore(cliente_id);

  const emoji = nota >= 4 ? '😊' : nota === 3 ? '😐' : '😞';
  await pool.query(
    `INSERT INTO timeline (cliente_id, tipo, titulo, descricao, usuario) VALUES ($1,'csat',$2,$3,$4)`,
    [cliente_id, `CSAT registrado: ${nota}/5 ${emoji}`, `Tipo: ${tipo_interacao || 'Geral'} · Respondente: ${respondente || 'N/A'}`, req.usuario.nome]
  );

  res.status(201).json(rows[0]);
});

// Excluir
router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query('DELETE FROM csat WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows.length) return res.status(404).json({ erro: 'Registro não encontrado.' });
  res.json({ ok: true });
});

module.exports = router;
