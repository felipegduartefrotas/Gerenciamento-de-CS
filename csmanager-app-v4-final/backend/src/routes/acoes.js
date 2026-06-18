const express = require('express');
const pool = require('../db/pool');
const { autenticar } = require('../middleware/auth');
const { comoArray } = require('../db/jsonbUtil');

const router = express.Router();
router.use(autenticar);

router.get('/', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT a.*, c.empresa FROM acoes a
    LEFT JOIN clientes c ON c.id = a.cliente_id
    ORDER BY a.criado_em DESC
  `);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { cliente_id, descricao, area, prioridade, status, progresso, responsavel, prazo, prazo_iso, comentarios, categoria, reuniao_tipo, reuniao_data, reuniao_hora, reuniao_pauta } = req.body;
  if (!descricao) return res.status(400).json({ erro: 'Descrição é obrigatória.' });

  const log = [{ texto: `Ação criada com status "${status || 'Pendente'}"`, em: new Date().toISOString(), por: req.usuario.nome }];

  const { rows } = await pool.query(
    `INSERT INTO acoes (cliente_id, descricao, area, prioridade, status, progresso, responsavel, prazo, prazo_iso, comentarios, categoria, reuniao_tipo, reuniao_data, reuniao_hora, reuniao_pauta, log, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
    [cliente_id || null, descricao, area, prioridade || 'Média', status || 'Pendente', progresso || 0,
     responsavel, prazo, prazo_iso || null, comentarios, categoria || null,
     reuniao_tipo || null, reuniao_data || null, reuniao_hora || null, reuniao_pauta || null,
     JSON.stringify(log), req.usuario.nome]
  );

  if (cliente_id) {
    await pool.query(
      `INSERT INTO timeline (cliente_id, tipo, titulo, descricao, usuario) VALUES ($1,'acao',$2,$3,$4)`,
      [cliente_id, `Ação criada: ${descricao}`, `Criada por ${req.usuario.nome} · Status inicial: ${status || 'Pendente'}`, req.usuario.nome]
    );
  }
  res.status(201).json(rows[0]);
});

// Atualiza status (drag-and-drop ou edição) com log + timeline, igual à lógica validada no frontend
router.patch('/:id/status', async (req, res) => {
  const { status, encerrado } = req.body;
  const atual = await pool.query('SELECT * FROM acoes WHERE id = $1', [req.params.id]);
  if (!atual.rows.length) return res.status(404).json({ erro: 'Ação não encontrada.' });
  const a = atual.rows[0];
  const statusAnterior = a.status;

  const progresso = status === 'Concluído' ? 100 : a.progresso;
  const novoLog = [...comoArray(a.log), {
    texto: `Status alterado de "${statusAnterior}" para "${status}"${encerrado ? ' (encerrado)' : ''}`,
    em: new Date().toISOString(), por: req.usuario.nome,
  }];

  const { rows } = await pool.query(
    `UPDATE acoes SET status=$1, progresso=$2, log=$3, ultima_alteracao_em=now(), ultima_alteracao_por=$4
     WHERE id=$5 RETURNING *`,
    [status, progresso, JSON.stringify(novoLog), req.usuario.nome, req.params.id]
  );

  if (a.cliente_id) {
    await pool.query(
      `INSERT INTO timeline (cliente_id, tipo, titulo, descricao, usuario) VALUES ($1,'acao',$2,$3,$4)`,
      [a.cliente_id, `Ação atualizada: ${a.descricao}`, `Status: "${statusAnterior}" → "${status}" · por ${req.usuario.nome}`, req.usuario.nome]
    );
  }
  res.json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { descricao, area, prioridade, progresso, responsavel, prazo, comentarios } = req.body;
  const atual = await pool.query('SELECT * FROM acoes WHERE id = $1', [req.params.id]);
  if (!atual.rows.length) return res.status(404).json({ erro: 'Ação não encontrada.' });
  const a = atual.rows[0];

  const novoLog = [...comoArray(a.log), { texto: 'Detalhes da ação editados', em: new Date().toISOString(), por: req.usuario.nome }];

  const { rows } = await pool.query(
    `UPDATE acoes SET descricao=$1, area=$2, prioridade=$3, progresso=$4, responsavel=$5, prazo=$6, comentarios=$7,
     log=$8, ultima_alteracao_em=now(), ultima_alteracao_por=$9 WHERE id=$10 RETURNING *`,
    [descricao, area, prioridade, progresso, responsavel, prazo, comentarios, JSON.stringify(novoLog), req.usuario.nome, req.params.id]
  );
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query('DELETE FROM acoes WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows.length) return res.status(404).json({ erro: 'Ação não encontrada.' });
  res.json({ ok: true });
});

module.exports = router;
