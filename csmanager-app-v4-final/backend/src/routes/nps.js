const express = require('express');
const pool = require('../db/pool');
const { autenticar } = require('../middleware/auth');
const { recalcularHealthScore } = require('./reunioes');

const router = express.Router();
router.use(autenticar);

function calcularNPS(notas) {
  if (!notas.length) return { score: null, promotores: 0, neutros: 0, detratores: 0, total: 0, promPct: 0, neuPct: 0, detPct: 0 };
  const promotores = notas.filter(n => n >= 9).length;
  const neutros = notas.filter(n => n >= 7 && n <= 8).length;
  const detratores = notas.filter(n => n <= 6).length;
  const total = notas.length;
  const promPct = Math.round((promotores / total) * 100);
  const neuPct = Math.round((neutros / total) * 100);
  const detPct = Math.round((detratores / total) * 100);
  const score = promPct - detPct;
  return { score, promotores, neutros, detratores, total, promPct, neuPct, detPct };
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT n.*, c.empresa FROM nps n
    LEFT JOIN clientes c ON c.id = n.cliente_id
    ORDER BY n.data_iso DESC
  `);
  res.json(rows);
});

router.get('/geral', async (req, res) => {
  const { rows } = await pool.query('SELECT nota FROM nps');
  res.json(calcularNPS(rows.map(r => r.nota)));
});

router.get('/cliente/:clienteId', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM nps WHERE cliente_id = $1 ORDER BY data_iso DESC',
    [req.params.clienteId]
  );
  res.json(rows);
});

router.get('/cliente/:clienteId/calculo', async (req, res) => {
  const { rows } = await pool.query('SELECT nota FROM nps WHERE cliente_id = $1', [req.params.clienteId]);
  res.json(calcularNPS(rows.map(r => r.nota)));
});

router.post('/', async (req, res) => {
  const { cliente_id, nota, respondente, cargo, comentario } = req.body;
  if (!cliente_id || nota === undefined) return res.status(400).json({ erro: 'cliente_id e nota são obrigatórios.' });
  if (nota < 0 || nota > 10) return res.status(400).json({ erro: 'Nota deve ser entre 0 e 10.' });

  const { rows } = await pool.query(
    `INSERT INTO nps (cliente_id, nota, respondente, cargo, comentario, cs)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [cliente_id, nota, respondente || 'N/A', cargo, comentario, req.usuario.nome]
  );

  await recalcularHealthScore(cliente_id);

  const grupo = nota >= 9 ? 'Promotor' : nota >= 7 ? 'Neutro' : 'Detrator';
  await pool.query(
    `INSERT INTO timeline (cliente_id, tipo, titulo, descricao, usuario) VALUES ($1,'nps',$2,$3,$4)`,
    [cliente_id, `Pesquisa NPS registrada: ${nota}/10`, `Grupo: ${grupo} · Respondente: ${respondente || 'N/A'}`, req.usuario.nome]
  );

  res.status(201).json(rows[0]);
});

module.exports = router;
