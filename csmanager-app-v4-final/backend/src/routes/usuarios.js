const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { autenticar, exigirAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar, exigirAdmin); // todas as rotas abaixo exigem admin

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nome, email, papel, ativo, criado_em FROM usuarios ORDER BY criado_em ASC'
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { nome, email, senha, papel } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' });
  }
  if (senha.length < 8) {
    return res.status(400).json({ erro: 'A senha deve ter ao menos 8 caracteres.' });
  }
  try {
    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, papel)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome, email, papel, ativo, criado_em`,
      [nome, email.trim().toLowerCase(), hash, ['admin','gerencial','consultor'].includes(papel) ? papel : 'consultor']
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um usuário com este e-mail.' });
    }
    console.error(e);
    res.status(500).json({ erro: 'Erro ao criar usuário.' });
  }
});

router.patch('/:id', async (req, res) => {
  const { nome, papel, ativo, senha } = req.body;
  const campos = [];
  const valores = [];
  let i = 1;
  if (nome !== undefined) { campos.push(`nome = $${i++}`); valores.push(nome); }
  if (papel !== undefined) { campos.push(`papel = $${i++}`); valores.push(['admin','gerencial','consultor'].includes(papel) ? papel : 'consultor'); }
  if (ativo !== undefined) { campos.push(`ativo = $${i++}`); valores.push(!!ativo); }
  if (senha) {
    if (senha.length < 8) return res.status(400).json({ erro: 'A senha deve ter ao menos 8 caracteres.' });
    const hash = await bcrypt.hash(senha, 10);
    campos.push(`senha_hash = $${i++}`); valores.push(hash);
  }
  if (!campos.length) return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });
  valores.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE usuarios SET ${campos.join(', ')} WHERE id = $${i} RETURNING id, nome, email, papel, ativo`,
    valores
  );
  if (!rows.length) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  if (req.params.id === req.usuario.id) {
    return res.status(400).json({ erro: 'Você não pode desativar sua própria conta.' });
  }
  const { rows } = await pool.query(
    'UPDATE usuarios SET ativo = false WHERE id = $1 RETURNING id',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  res.json({ ok: true });
});

module.exports = router;
