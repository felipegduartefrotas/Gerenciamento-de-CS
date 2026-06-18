const express = require('express');
const pool = require('../db/pool');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

router.get('/', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT r.*, c.empresa FROM reunioes r
    LEFT JOIN clientes c ON c.id = r.cliente_id
    ORDER BY r.data_iso DESC
  `);
  res.json(rows);
});

router.get('/cliente/:clienteId', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM reunioes WHERE cliente_id = $1 ORDER BY data_iso DESC',
    [req.params.clienteId]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const {
    cliente_id, tipo, csat, nps, sentimento,
    participantes_creare, participantes_cliente,
    pontos_positivos, problemas_identificados, melhorias, proxima_reuniao, resumo_ia
  } = req.body;
  if (!cliente_id) return res.status(400).json({ erro: 'cliente_id é obrigatório.' });

  const { rows } = await pool.query(
    `INSERT INTO reunioes (cliente_id, tipo, csat, nps, sentimento, responsavel,
       participantes_creare, participantes_cliente, pontos_positivos, problemas_identificados,
       melhorias, proxima_reuniao, resumo_ia)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [cliente_id, tipo, csat, nps, sentimento, req.usuario.nome,
     JSON.stringify(participantes_creare || []), JSON.stringify(participantes_cliente || []),
     pontos_positivos, problemas_identificados, melhorias, proxima_reuniao, resumo_ia]
  );

  // Recalcula health score do cliente após a reunião (mesma lógica do frontend original)
  await recalcularHealthScore(cliente_id);

  const cliente = await pool.query('SELECT empresa FROM clientes WHERE id = $1', [cliente_id]);
  await pool.query(
    `INSERT INTO timeline (cliente_id, tipo, titulo, descricao, usuario) VALUES ($1,'reuniao',$2,$3,$4)`,
    [cliente_id, `Reunião realizada: ${tipo}`, `CSAT ${csat}/10 · NPS ${nps}/10 · ${sentimento || ''}`, req.usuario.nome]
  );

  res.status(201).json(rows[0]);
});

async function recalcularHealthScore(clienteId) {
  const reunioes = await pool.query('SELECT * FROM reunioes WHERE cliente_id = $1 ORDER BY data_iso DESC', [clienteId]);
  const acoes = await pool.query("SELECT * FROM acoes WHERE cliente_id = $1 AND status != 'Concluído'", [clienteId]);
  const npsRows = await pool.query('SELECT * FROM nps WHERE cliente_id = $1', [clienteId]);
  const cliente = await pool.query('SELECT * FROM clientes WHERE id = $1', [clienteId]);
  if (!cliente.rows.length) return;
  const c = cliente.rows[0];
  const re = reunioes.rows;
  const now = new Date();

  let s = 70;
  if (re.length > 0) {
    const d = Math.floor((now - new Date(re[0].data_iso)) / 86400000);
    if (d <= 15) s += 10; else if (d <= 30) s += 5; else if (d <= 45) s -= 5; else if (d <= 60) s -= 15; else s -= 25;
  } else s -= 20;

  if (re.length > 0) {
    const cm = re.slice(0, 3).reduce((t, r) => t + (r.csat || 7), 0) / Math.min(re.length, 3);
    if (cm >= 9) s += 10; else if (cm >= 7) s += 5; else if (cm >= 5) s -= 5; else s -= 15;
  }

  let ultimoNps = c.ultimo_nps;
  if (npsRows.rows.length > 0) {
    const notas = npsRows.rows.map(n => n.nota);
    const prom = notas.filter(n => n >= 9).length, det = notas.filter(n => n <= 6).length;
    const score = Math.round(((prom - det) / notas.length) * 100);
    if (score >= 75) s += 15; else if (score >= 50) s += 8; else if (score >= 25) s += 2; else if (score >= 0) s -= 8; else s -= 18;
    ultimoNps = score;
  }

  const atrasadas = acoes.rows.filter(a => a.prazo_iso && new Date(a.prazo_iso) < now);
  s -= Math.min(atrasadas.length * 5, 20);

  if (c.status === 'Expansão') s += 8;
  if (c.status === 'Em Risco') s -= 15;
  if (c.status === 'Implantação') s -= 5;

  const healthScore = Math.max(0, Math.min(100, Math.round(s)));
  await pool.query('UPDATE clientes SET health_score = $1, ultimo_nps = $2 WHERE id = $3', [healthScore, ultimoNps, clienteId]);
}

module.exports = router;
module.exports.recalcularHealthScore = recalcularHealthScore;
