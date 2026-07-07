const express = require('express');
const pool = require('../db/pool');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const cu = require('../services/clickup');

const router = express.Router();

// ── Status da integração (público para o frontend saber se está ativa) ────────
router.get('/status', autenticar, (req, res) => {
  res.json({
    configurado: cu.isConfigurado(),
    bidirecional: cu.podeEnviar(),
    list_id: process.env.CLICKUP_LIST_ID ? '***configurado***' : null,
  });
});

// ── Webhook recebido do ClickUp ───────────────────────────────────────────────
// URL que o TI deve cadastrar no ClickUp: https://SEU_SERVIDOR/api/clickup/webhook
// No ClickUp: Settings → Integrations → Webhooks → Add Webhook
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    // Verificação opcional da assinatura do webhook
    const secret = process.env.CLICKUP_WEBHOOK_SECRET;
    if (secret) {
      const sig = req.headers['x-signature'];
      if (!sig) return res.status(401).json({ erro: 'Assinatura ausente.' });
      const crypto = require('crypto');
      const esperado = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
      if (sig !== esperado) return res.status(401).json({ erro: 'Assinatura inválida.' });
    }

    const payload = JSON.parse(req.body.toString());
    const acao = cu.interpretarWebhook(payload);
    if (!acao) return res.json({ ok: true, ignorado: true });

    if (acao.tipo === 'status') {
      // Atualiza status da ação no CS Manager
      const { rows } = await pool.query(
        'SELECT * FROM acoes WHERE clickup_task_id = $1',
        [acao.taskId]
      );
      if (rows.length) {
        const a = rows[0];
        const progresso = acao.statusCSM === 'Concluído' ? 100 : a.progresso;
        await pool.query(
          `UPDATE acoes SET status=$1, progresso=$2, ultima_alteracao_em=now(), ultima_alteracao_por='ClickUp'
           WHERE clickup_task_id=$3`,
          [acao.statusCSM, progresso, acao.taskId]
        );
        if (a.cliente_id) {
          await pool.query(
            `INSERT INTO timeline (cliente_id, tipo, titulo, descricao, usuario) VALUES ($1,'acao',$2,$3,$4)`,
            [a.cliente_id, `Ação atualizada via ClickUp: ${a.descricao}`,
             `Status atualizado para "${acao.statusCSM}" pelo ClickUp`, 'ClickUp']
          );
        }
      }
    }

    if (acao.tipo === 'deletado') {
      await pool.query(
        "UPDATE acoes SET clickup_task_id=NULL WHERE clickup_task_id=$1",
        [acao.taskId]
      );
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('Erro no webhook ClickUp:', e.message);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ── Sincronização manual (admin) ──────────────────────────────────────────────
// Sincroniza todas as ações sem clickup_task_id para o ClickUp
router.post('/sincronizar', autenticar, apenasAdmin, async (req, res) => {
  if (!cu.isConfigurado()) return res.status(400).json({ erro: 'ClickUp não configurado.' });
  const { rows } = await pool.query(`
    SELECT a.*, c.empresa FROM acoes a
    LEFT JOIN clientes c ON c.id = a.cliente_id
    WHERE a.clickup_task_id IS NULL AND a.status != 'Concluído' AND a.status != 'Cancelada'
    ORDER BY a.criado_em DESC LIMIT 100
  `);
  let criados = 0, erros = 0;
  for (const a of rows) {
    try {
      const taskId = await cu.criarTarefaAcao(a);
      if (taskId) {
        await pool.query('UPDATE acoes SET clickup_task_id=$1 WHERE id=$2', [taskId, a.id]);
        criados++;
      }
    } catch (e) {
      console.error(`Erro ao sincronizar ação ${a.id}:`, e.message);
      erros++;
    }
  }
  res.json({ ok: true, criados, erros, total: rows.length });
});

module.exports = router;
