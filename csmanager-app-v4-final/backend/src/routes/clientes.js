const express = require('express');
const pool = require('../db/pool');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

const CAMPOS = [
  'empresa','nome_fantasia','cnpj','natureza_juridica','porte','situacao_rf','data_abertura','cnae',
  'segmento','logradouro','numero','complemento','bairro','cidade','uf','regiao',
  'contato','cargo','email','telefone','responsavel_cs','responsavel_comercial',
  'tier','status','mensalidade_por_veiculo','taxa_adesao_por_veiculo','mrr','veiculos',
  'inicio','data_assinatura','vigencia','produtos','health_score','ultimo_nps',
  'data_renovacao','renovacao',
];

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clientes ORDER BY empresa ASC');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clientes WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ erro: 'Cliente não encontrado.' });
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  if (!req.body.empresa) return res.status(400).json({ erro: 'Razão Social é obrigatória.' });
  const colunas = CAMPOS.filter(c => req.body[c] !== undefined);
  const valores = colunas.map(c => req.body[c]);
  const placeholders = colunas.map((_, i) => `$${i + 1}`);
  try {
    const { rows } = await pool.query(
      `INSERT INTO clientes (${colunas.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`,
      valores
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') { // violação de índice único (CNPJ duplicado)
      return res.status(409).json({ erro: 'Já existe um cliente cadastrado com este CNPJ.' });
    }
    throw e;
  }
});

router.put('/:id', async (req, res) => {
  const colunas = CAMPOS.filter(c => req.body[c] !== undefined);
  if (!colunas.length) return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });
  const sets = colunas.map((c, i) => `${c} = $${i + 1}`);
  const valores = colunas.map(c => req.body[c]);
  sets.push(`ultima_alteracao_em = now()`, `ultima_alteracao_por = $${valores.length + 1}`, `atualizado_em = now()`);
  valores.push(req.usuario.nome);
  valores.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE clientes SET ${sets.join(', ')} WHERE id = $${valores.length} RETURNING *`,
      valores
    );
    if (!rows.length) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ erro: 'Já existe outro cliente cadastrado com este CNPJ.' });
    }
    throw e;
  }
});

router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query('DELETE FROM clientes WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows.length) return res.status(404).json({ erro: 'Cliente não encontrado.' });
  res.json({ ok: true });
});

module.exports = router;
