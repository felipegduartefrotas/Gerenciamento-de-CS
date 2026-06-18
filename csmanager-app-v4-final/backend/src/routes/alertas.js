const express = require('express');
const https = require('https');
const http = require('http');
const pool = require('../db/pool');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

async function getConfig() {
  const { rows } = await pool.query('SELECT chave, valor FROM configuracoes');
  const cfg = {};
  rows.forEach(r => { cfg[r.chave] = r.valor; });
  return cfg;
}

router.get('/', async (req, res) => {
  const cfg = await getConfig();
  const diasSemContato = Number(cfg.alertaDiasSemContato) || 30;
  const hsMinimo = Number(cfg.alertaHSMinimo) || 50;
  const npsMinimo = Number(cfg.alertaNPSMinimo) || 20;
  const diasRenovacao = Number(cfg.alertaDiasRenovacao) || 60;

  // Busca tudo de uma vez (poucas queries totais, não uma por cliente) e agrupa em memória.
  // Evita o padrão N+1 que existia aqui antes (4 queries × N clientes).
  const [clientesRes, reunioesRes, npsRes, acoesAtrasadasRes, reunioesAgendadasRes, dismissedRes] = await Promise.all([
    pool.query('SELECT * FROM clientes'),
    pool.query('SELECT cliente_id, data_iso FROM reunioes ORDER BY cliente_id, data_iso DESC'),
    pool.query('SELECT cliente_id, nota FROM nps'),
    pool.query(`SELECT * FROM acoes WHERE status != 'Concluído' AND prazo_iso < now()
       AND (categoria IS NULL OR categoria != 'reuniao_agendada')`),
    pool.query(`SELECT * FROM acoes WHERE categoria = 'reuniao_agendada'
       AND status NOT IN ('Concluído','Cancelada') AND prazo_iso IS NOT NULL`),
    pool.query('SELECT alerta_id, dispensado_em FROM alertas_dismissed'),
  ]);

  const clientes = clientesRes.rows;

  // Pega só a reunião mais recente de cada cliente (a query já vem ordenada por data desc)
  const ultimaReuniaoPorCliente = new Map();
  for (const r of reunioesRes.rows) {
    if (!ultimaReuniaoPorCliente.has(r.cliente_id)) ultimaReuniaoPorCliente.set(r.cliente_id, r);
  }
  const npsPorCliente = new Map();
  for (const n of npsRes.rows) {
    if (!npsPorCliente.has(n.cliente_id)) npsPorCliente.set(n.cliente_id, []);
    npsPorCliente.get(n.cliente_id).push(n.nota);
  }
  const acoesAtrasadasPorCliente = new Map();
  for (const a of acoesAtrasadasRes.rows) {
    if (!acoesAtrasadasPorCliente.has(a.cliente_id)) acoesAtrasadasPorCliente.set(a.cliente_id, []);
    acoesAtrasadasPorCliente.get(a.cliente_id).push(a);
  }
  const reunioesAgendadasPorCliente = new Map();
  for (const ra of reunioesAgendadasRes.rows) {
    if (!reunioesAgendadasPorCliente.has(ra.cliente_id)) reunioesAgendadasPorCliente.set(ra.cliente_id, []);
    reunioesAgendadasPorCliente.get(ra.cliente_id).push(ra);
  }

  // Dispensa expira após 7 dias: evita que um alerta fique escondido para sempre mesmo
  // que a situação do cliente piore depois de dispensado uma vez.
  const SETE_DIAS_MS = 7 * 86400000;
  const agora2 = Date.now();
  const dismissed = new Set(
    dismissedRes.rows
      .filter(r => (agora2 - new Date(r.dispensado_em).getTime()) < SETE_DIAS_MS)
      .map(r => r.alerta_id)
  );

  const now = new Date();
  const hojeZero = new Date(); hojeZero.setHours(0, 0, 0, 0);
  const alertas = [];

  for (const c of clientes) {
    const ultimaReuniao = ultimaReuniaoPorCliente.get(c.id);

    if (ultimaReuniao) {
      const dias = Math.floor((now - new Date(ultimaReuniao.data_iso)) / 86400000);
      if (dias >= diasSemContato) {
        alertas.push({ id: 'sem_' + c.id, categoria: 'sem_contato', tipo: dias > 45 ? 'danger' : 'warn',
          icone: 'ti-clock', titulo: `${c.empresa} — ${dias} dias sem contato`,
          subtitulo: `HS: ${c.health_score} · Última reunião: ${ultimaReuniao.data_iso}`,
          tag: dias > 45 ? 'Urgente' : 'Alta', clienteId: c.id });
      }
    } else {
      alertas.push({ id: 'novo_' + c.id, categoria: 'sem_reuniao', tipo: 'info',
        icone: 'ti-user-plus', titulo: `${c.empresa} — Sem reuniões registradas`,
        subtitulo: 'Agende a primeira reunião.', tag: 'Info', clienteId: c.id });
    }

    if (c.health_score < hsMinimo) {
      alertas.push({ id: 'hs_' + c.id, categoria: 'hs_baixo', tipo: c.health_score < 40 ? 'danger' : 'warn',
        icone: 'ti-trending-down', titulo: `${c.empresa} — Health Score: ${c.health_score}`,
        subtitulo: `Conta ${c.health_score < 40 ? 'crítica' : 'em atenção'}. Status: ${c.status}`,
        tag: c.health_score < 40 ? 'Urgente' : 'Alta', clienteId: c.id });
    }

    const notas = npsPorCliente.get(c.id) || [];
    if (notas.length > 0) {
      const prom = notas.filter(n => n >= 9).length, det = notas.filter(n => n <= 6).length;
      const score = Math.round(((prom - det) / notas.length) * 100);
      if (score < npsMinimo) {
        alertas.push({ id: 'nps_' + c.id, categoria: 'nps_critico', tipo: 'danger',
          icone: 'ti-mood-sad', titulo: `${c.empresa} — NPS crítico: ${score}`,
          subtitulo: `Detratores: ${Math.round((det / notas.length) * 100)}%`, tag: 'Urgente', clienteId: c.id });
      }
    }

    if (c.data_renovacao) {
      const dr = new Date(c.data_renovacao);
      const dias2 = Math.floor((dr - now) / 86400000);
      if (dias2 > 0 && dias2 <= diasRenovacao) {
        alertas.push({ id: 'ren_' + c.id, categoria: 'renovacao', tipo: 'warn',
          icone: 'ti-calendar-exclamation', titulo: `${c.empresa} — Renovação em ${dias2} dias`,
          subtitulo: `MRR: ${c.mrr}`, tag: dias2 <= 30 ? 'Urgente' : 'Alta', clienteId: c.id });
      } else if (dias2 < 0) {
        alertas.push({ id: 'ven_' + c.id, categoria: 'vencido', tipo: 'danger',
          icone: 'ti-alert-triangle', titulo: `${c.empresa} — Contrato VENCIDO há ${Math.abs(dias2)} dias`,
          subtitulo: 'Renegociação urgente.', tag: 'Urgente', clienteId: c.id });
      }
    }

    const acoesAtrasadas = acoesAtrasadasPorCliente.get(c.id) || [];
    if (acoesAtrasadas.length > 0) {
      alertas.push({ id: 'acv_' + c.id, categoria: 'acoes_atrasadas', tipo: 'warn',
        icone: 'ti-clipboard-x', titulo: `${c.empresa} — ${acoesAtrasadas.length} ação(ões) em atraso`,
        subtitulo: acoesAtrasadas.map(a => a.descricao).slice(0, 2).join(', '),
        tag: 'Alta', clienteId: c.id, acaoIds: acoesAtrasadas.map(a => a.id) });
    }

    const reunioesAgendadas = reunioesAgendadasPorCliente.get(c.id) || [];
    for (const ra of reunioesAgendadas) {
      const dataReuniao = new Date(ra.prazo_iso);
      const diasReuniao = Math.floor((dataReuniao - hojeZero) / 86400000);
      if (diasReuniao === 0) {
        alertas.push({ id: 'reun_hoje_' + ra.id, categoria: 'reuniao_hoje', tipo: 'warn',
          icone: 'ti-calendar-event', titulo: `${c.empresa} — Reunião HOJE: ${ra.reuniao_tipo}`,
          subtitulo: `${ra.reuniao_hora ? 'Às ' + ra.reuniao_hora + ' · ' : ''}Responsável: ${ra.responsavel}`,
          tag: 'Urgente', clienteId: c.id, acaoId: ra.id });
      } else if (diasReuniao < 0) {
        alertas.push({ id: 'reun_atrasada_' + ra.id, categoria: 'reuniao_atrasada', tipo: 'danger',
          icone: 'ti-calendar-x', titulo: `${c.empresa} — Reunião não tratada: ${ra.reuniao_tipo}`,
          subtitulo: `Estava agendada para ${ra.reuniao_data}, ${Math.abs(diasReuniao)} dia(s) atrás`,
          tag: 'Urgente', clienteId: c.id, acaoId: ra.id });
      }
    }
  }

  res.json(alertas.filter(a => !dismissed.has(a.id)));
});

router.post('/:id/dismiss', async (req, res) => {
  await pool.query(
    'INSERT INTO alertas_dismissed (alerta_id) VALUES ($1) ON CONFLICT DO NOTHING',
    [req.params.id]
  );
  res.json({ ok: true });
});

// Dispara os alertas ativos para o webhook configurado em "webhookUrl"
router.post('/disparar-webhook', async (req, res) => {
  const { rows: cfgRows } = await pool.query(
    "SELECT valor FROM configuracoes WHERE chave = 'webhookUrl'"
  );
  const webhookUrl = cfgRows[0]?.valor?.replace(/^"|"$/g, '') || '';
  if (!webhookUrl) return res.status(400).json({ erro: 'Webhook URL não configurada.' });

  // Reutiliza a lógica de listagem de alertas (chama o próprio endpoint internamente)
  // mas aqui fazemos direto para não duplicar código
  const { rows: cfg } = await pool.query('SELECT chave, valor FROM configuracoes');
  const c = {};
  cfg.forEach(r => { c[r.chave] = r.valor; });
  const diasSemContato = Number(c.alertaDiasSemContato) || 30;
  const hsMinimo = Number(c.alertaHSMinimo) || 50;

  const clientesRes = await pool.query(
    `SELECT c.id, c.empresa, c.health_score, c.status,
            MAX(r.data_iso) AS ultima_reuniao
     FROM clientes c
     LEFT JOIN reunioes r ON r.cliente_id = c.id
     GROUP BY c.id`
  );
  const now = new Date();
  const alertas = [];
  for (const cl of clientesRes.rows) {
    if (cl.ultima_reuniao) {
      const dias = Math.floor((now - new Date(cl.ultima_reuniao)) / 86400000);
      if (dias >= diasSemContato)
        alertas.push({ tipo: 'sem_contato', empresa: cl.empresa, dias });
    }
    if (cl.health_score < hsMinimo)
      alertas.push({ tipo: 'hs_baixo', empresa: cl.empresa, hs: cl.health_score });
  }

  if (!alertas.length) return res.json({ ok: true, enviados: 0 });

  const payload = JSON.stringify({
    sistema: 'CS Manager — Creare Sistemas',
    gerado_em: new Date().toISOString(),
    total_alertas: alertas.length,
    alertas,
  });

  try {
    const url = new URL(webhookUrl);
    const mod = url.protocol === 'https:' ? https : http;
    await new Promise((resolve, reject) => {
      const req2 = mod.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, r2 => { r2.resume(); resolve(); });
      req2.on('error', reject);
      req2.write(payload);
      req2.end();
    });
    res.json({ ok: true, enviados: alertas.length });
  } catch (e) {
    console.error('Webhook error:', e.message);
    res.status(502).json({ erro: 'Falha ao enviar para o webhook: ' + e.message });
  }
});

module.exports = router;
