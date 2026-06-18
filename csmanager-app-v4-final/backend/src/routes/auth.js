const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const { gerarToken, autenticar } = require('../middleware/auth');

const router = express.Router();

// Limita tentativas de login para mitigar força bruta
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { erro: 'Muitas tentativas de login. Aguarde alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ erro: 'Informe e-mail e senha.' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND ativo = true',
      [email.trim().toLowerCase()]
    );
    const usuario = rows[0];
    if (!usuario) {
      return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
    }
    const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaOk) {
      return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
    }
    const token = gerarToken(usuario);
    res.json({
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
    });
  } catch (e) {
    console.error('Erro no login:', e);
    res.status(500).json({ erro: 'Erro interno ao processar login.' });
  }
});

router.get('/me', autenticar, (req, res) => {
  res.json({ usuario: req.usuario });
});

router.post('/trocar-senha', autenticar, async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  if (!senhaAtual || !novaSenha) {
    return res.status(400).json({ erro: 'Informe a senha atual e a nova senha.' });
  }
  if (novaSenha.length < 8) {
    return res.status(400).json({ erro: 'A nova senha deve ter ao menos 8 caracteres.' });
  }
  const { rows } = await pool.query('SELECT senha_hash FROM usuarios WHERE id = $1', [req.usuario.id]);
  if (!rows.length) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  const ok = await bcrypt.compare(senhaAtual, rows[0].senha_hash);
  if (!ok) return res.status(401).json({ erro: 'Senha atual incorreta.' });
  const hash = await bcrypt.hash(novaSenha, 10);
  await pool.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, req.usuario.id]);
  res.json({ ok: true });
});

module.exports = router;
