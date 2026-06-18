const express = require('express');
const pool = require('../db/pool');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// Lista todos os grupos com métricas consolidadas
router.get('/', async (req, res) => {
  const { rows: grupos } = await pool.query(
    `SELECT g.id, g.nome, g.descricao, g.criado_em,
       COUNT(c.id)::int AS total_empresas,
       ROUND(AVG(c.health_score))::int AS hs_medio,
       COALESCE(SUM(c.mensalidade_por_veiculo * NULLIF(c.veiculos,'')::numeric), 0)::numeric AS mrr_total,
       bool_or(c.tipo_no_grupo = 'matriz') AS tem_matriz
     FROM grupos_economicos g
     LEFT JOIN clientes c ON c.grupo_id = g.id
     GROUP BY g.id
     ORDER BY g.nome`
  );
  res.json(grupos);
});

// Detalhe de um grupo: membros + NPS consolidado
router.get('/:id', async (req, res) => {
  const { rows: grupos } = await pool.query(
    'SELECT * FROM grupos_economicos WHERE id = $1', [req.params.id]
  );
  if (!grupos.length) return res.status(404).json({ erro: 'Grupo não encontrado.' });

  const [membrosRes, npsRes] = await Promise.all([
    pool.query(
      `SELECT id, empresa, nome_fantasia, status, tier, health_score, mrr,
              mensalidade_por_veiculo, veiculos, responsavel_cs, tipo_no_grupo, ultimo_nps
       FROM clientes WHERE grupo_id = $1
       ORDER BY tipo_no_grupo ASC NULLS LAST, empresa ASC`,
      [req.params.id]
    ),
    pool.query(
      `SELECT n.nota, n.data_iso FROM nps n
       JOIN clientes c ON c.id = n.cliente_id
       WHERE c.grupo_id = $1 ORDER BY n.data_iso DESC`,
      [req.params.id]
    ),
  ]);

  const notas = npsRes.rows.map(r => r.nota);
  let npsConsolidado = null;
  if (notas.length) {
    const prom = notas.filter(n => n >= 9).length;
    const det = notas.filter(n => n <= 6).length;
    npsConsolidado = Math.round(((prom - det) / notas.length) * 100);
  }

  const membros = membrosRes.rows;
  const mrrTotal = membros.reduce((soma, c) => {
    const mensalidade = parseFloat(c.mensalidade_por_veiculo) || 0;
    const veiculos = parseFloat(c.veiculos) || 0;
    return soma + mensalidade * veiculos;
  }, 0);

  res.json({
    ...grupos[0],
    membros,
    nps_consolidado: npsConsolidado,
    total_nps: notas.length,
    mrr_total: mrrTotal,
    hs_medio: membros.length
      ? Math.round(membros.reduce((s, c) => s + (c.health_score || 70), 0) / membros.length)
      : null,
  });
});

// Cria novo grupo
router.post('/', async (req, res) => {
  const { nome, descricao } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Nome do grupo é obrigatório.' });
  const { rows } = await pool.query(
    'INSERT INTO grupos_economicos (nome, descricao) VALUES ($1, $2) RETURNING *',
    [nome.trim().toUpperCase(), descricao || null]
  );
  res.status(201).json(rows[0]);
});

// Atualiza grupo
router.put('/:id', async (req, res) => {
  const { nome, descricao } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Nome do grupo é obrigatório.' });
  const { rows } = await pool.query(
    'UPDATE grupos_economicos SET nome = $1, descricao = $2 WHERE id = $3 RETURNING *',
    [nome.trim().toUpperCase(), descricao || null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Grupo não encontrado.' });
  res.json(rows[0]);
});

// Exclui grupo (desvincula clientes, não os apaga)
router.delete('/:id', async (req, res) => {
  await pool.query(
    'UPDATE clientes SET grupo_id = NULL, tipo_no_grupo = NULL WHERE grupo_id = $1',
    [req.params.id]
  );
  const { rows } = await pool.query(
    'DELETE FROM grupos_economicos WHERE id = $1 RETURNING id', [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Grupo não encontrado.' });
  res.json({ ok: true });
});

module.exports = router;
