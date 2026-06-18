const express = require('express');
const pool = require('../db/pool');
const { autenticar } = require('../middleware/auth');
const { comoArray } = require('../db/jsonbUtil');

const router = express.Router();
router.use(autenticar);

router.get('/cliente/:clienteId', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM timeline WHERE cliente_id = $1 ORDER BY data_iso DESC',
    [req.params.clienteId]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { cliente_id, tipo, titulo, descricao } = req.body;
  if (!cliente_id || !tipo) return res.status(400).json({ erro: 'cliente_id e tipo são obrigatórios.' });
  const { rows } = await pool.query(
    `INSERT INTO timeline (cliente_id, tipo, titulo, descricao, usuario)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [cliente_id, tipo, titulo, descricao, req.usuario.nome]
  );
  res.status(201).json(rows[0]);
});

// Edita um item, preservando a versão anterior no histórico (igual à lógica do frontend original)
router.put('/:id', async (req, res) => {
  const { titulo, descricao } = req.body;
  if (!titulo || !descricao) return res.status(400).json({ erro: 'Título e descrição não podem ficar vazios.' });

  const atual = await pool.query('SELECT * FROM timeline WHERE id = $1', [req.params.id]);
  if (!atual.rows.length) return res.status(404).json({ erro: 'Registro não encontrado.' });
  const item = atual.rows[0];

  if (item.tipo === 'sistema') {
    return res.status(403).json({ erro: 'Registros de sistema são apenas leitura.' });
  }
  if (item.titulo === titulo && item.descricao === descricao) {
    return res.json(item); // nada mudou
  }

  const historicoAtual = comoArray(item.historico);

  const novoHistorico = [...historicoAtual, {
    tituloAnterior: item.titulo,
    descricaoAnterior: item.descricao,
    editadoEm: new Date().toISOString(),
    editadoPor: req.usuario.nome,
  }];

  const { rows } = await pool.query(
    `UPDATE timeline
     SET titulo = $1, descricao = $2, editado = true, ultima_edicao_em = now(), historico = $3
     WHERE id = $4 RETURNING *`,
    [titulo, descricao, JSON.stringify(novoHistorico), req.params.id]
  );
  res.json(rows[0]);
});

module.exports = router;
