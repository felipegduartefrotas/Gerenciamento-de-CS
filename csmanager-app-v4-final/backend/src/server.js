require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db/pool');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' })); // limite maior por causa de áudios em base64

// Health check — usado pelo Docker Compose para saber se o backend está de pé
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'conectado' });
  } catch (e) {
    res.status(503).json({ status: 'erro', db: 'desconectado' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/reunioes', require('./routes/reunioes'));
app.use('/api/acoes', require('./routes/acoes'));
app.use('/api/nps', require('./routes/nps'));
app.use('/api/timeline', require('./routes/timeline'));
app.use('/api/alertas', require('./routes/alertas'));
app.use('/api/audios', require('./routes/audios'));
app.use('/api/docs', require('./routes/docs'));
app.use('/api/csat', require('./routes/csat'));
app.use('/api/kv', require('./routes/kv'));
app.use('/api/config', require('./routes/config'));
app.use('/api/grupos', require('./routes/grupos'));
app.use('/api/hs-historico', require('./routes/hs_historico'));

app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

// Aguarda o banco estar pronto antes de subir o servidor (evita crash no boot do compose)
async function aguardarBanco(tentativas = 30) {
  for (let i = 0; i < tentativas; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('✓ Conectado ao PostgreSQL.');
      return;
    } catch (e) {
      console.log(`Aguardando banco de dados... (${i + 1}/${tentativas})`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('Não foi possível conectar ao banco de dados após várias tentativas.');
}

aguardarBanco()
  .then(() => {
    app.listen(PORT, () => console.log(`✓ Backend rodando na porta ${PORT}`));
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
