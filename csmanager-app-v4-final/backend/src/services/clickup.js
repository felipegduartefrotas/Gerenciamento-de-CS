// Serviço de integração com ClickUp API v2
// Ativa automaticamente quando CLICKUP_API_TOKEN e CLICKUP_LIST_ID estiverem no .env

const CLICKUP_BASE = 'https://api.clickup.com/api/v2';

function getConfig() {
  return {
    token: process.env.CLICKUP_API_TOKEN || '',
    listId: process.env.CLICKUP_LIST_ID || '',
    webhookSecret: process.env.CLICKUP_WEBHOOK_SECRET || '',
  };
}

function isConfigurado() {
  const { token, listId } = getConfig();
  return !!(token && listId);
}

// Retorna true somente se o envio CS Manager → ClickUp estiver habilitado pelo TI
function podeEnviar() {
  return isConfigurado() && process.env.CLICKUP_ENVIAR_TAREFAS === 'true';
}

async function _call(method, path, body) {
  const { token } = getConfig();
  const opts = {
    method,
    headers: { Authorization: token, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${CLICKUP_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`ClickUp ${res.status}: ${data.err || JSON.stringify(data)}`);
  return data;
}

// Mapeamento de prioridade CS Manager → ClickUp (1=urgent, 2=high, 3=normal, 4=low)
const _PRIORIDADE = { 'Crítica': 1, 'Alta': 2, 'Média': 3, 'Baixa': 4 };

// Mapeamento de status CS Manager → ClickUp
// Os nomes dos status do ClickUp dependem da configuração da lista.
// Os valores abaixo são os padrões mais comuns — se a lista usar outros nomes,
// o TI pode ajustar as variáveis CLICKUP_STATUS_* no .env.
function _statusClickUp(statusCSM) {
  const map = {
    'Pendente':     process.env.CLICKUP_STATUS_PENDENTE    || 'to do',
    'Em Andamento': process.env.CLICKUP_STATUS_ANDAMENTO   || 'in progress',
    'Concluído':    process.env.CLICKUP_STATUS_CONCLUIDO   || 'complete',
    'Cancelada':    process.env.CLICKUP_STATUS_CANCELADA   || 'cancelled',
  };
  return map[statusCSM] || statusCSM.toLowerCase();
}

// Mapeamento inverso: status ClickUp → CS Manager
function _statusCSM(statusClickUp) {
  const s = statusClickUp.toLowerCase();
  if (s === (process.env.CLICKUP_STATUS_CONCLUIDO || 'complete').toLowerCase())   return 'Concluído';
  if (s === (process.env.CLICKUP_STATUS_CANCELADA || 'cancelled').toLowerCase())  return 'Cancelada';
  if (s === (process.env.CLICKUP_STATUS_ANDAMENTO || 'in progress').toLowerCase()) return 'Em Andamento';
  return null; // não mapeia status intermediários desconhecidos
}

// ── Ações ────────────────────────────────────────────────────────────────────

async function criarTarefaAcao(acao) {
  if (!isConfigurado()) return null;
  const { listId } = getConfig();
  const body = {
    name: `[${acao.empresa || 'Sem cliente'}] ${acao.descricao}`,
    description: [
      `**Cliente:** ${acao.empresa || '—'}`,
      `**Área:** ${acao.area || '—'}`,
      `**Responsável:** ${acao.responsavel || '—'}`,
      `**ID CS Manager:** ${acao.id}`,
    ].join('\n'),
    priority: _PRIORIDADE[acao.prioridade] || 3,
    status: _statusClickUp(acao.status || 'Pendente'),
  };
  if (acao.prazo_iso) body.due_date = new Date(acao.prazo_iso).getTime();
  const data = await _call('POST', `/list/${listId}/task`, body);
  return data.id || null;
}

async function atualizarTarefaAcao(clickupTaskId, campos) {
  if (!isConfigurado() || !clickupTaskId) return;
  const body = {};
  if (campos.status)    body.status   = _statusClickUp(campos.status);
  if (campos.descricao) body.name     = campos.descricao;
  if (campos.prioridade) body.priority = _PRIORIDADE[campos.prioridade] || 3;
  if (campos.prazo_iso) body.due_date = new Date(campos.prazo_iso).getTime();
  await _call('PUT', `/task/${clickupTaskId}`, body);
}

async function excluirTarefaAcao(clickupTaskId) {
  if (!isConfigurado() || !clickupTaskId) return;
  await _call('DELETE', `/task/${clickupTaskId}`);
}

// ── Alertas críticos ─────────────────────────────────────────────────────────

async function criarTarefaAlerta({ empresa, titulo, descricao, prioridade }) {
  if (!isConfigurado()) return null;
  const { listId } = getConfig();
  const body = {
    name: `🚨 ALERTA [${empresa}] ${titulo}`,
    description: descricao || '',
    priority: _PRIORIDADE[prioridade] || 2,
    status: _statusClickUp('Pendente'),
    tags: ['alerta-cs'],
  };
  const data = await _call('POST', `/list/${listId}/task`, body);
  return data.id || null;
}

// ── Reuniões agendadas ───────────────────────────────────────────────────────

async function criarTarefaReuniao({ empresa, tipo, data, hora, pauta, responsavel }) {
  if (!isConfigurado()) return null;
  const { listId } = getConfig();
  const body = {
    name: `📅 Reunião [${empresa}] ${tipo}${data ? ' — ' + data : ''}`,
    description: [
      `**Cliente:** ${empresa}`,
      `**Tipo:** ${tipo}`,
      `**Data:** ${data || '—'} ${hora || ''}`,
      `**Pauta:** ${pauta || '—'}`,
      `**Responsável:** ${responsavel || '—'}`,
    ].join('\n'),
    priority: 3,
    status: _statusClickUp('Pendente'),
    tags: ['reuniao'],
  };
  if (data) {
    try { body.due_date = new Date(data.split('/').reverse().join('-')).getTime(); } catch {}
  }
  const data2 = await _call('POST', `/list/${listId}/task`, body);
  return data2.id || null;
}

// ── Webhook: converte evento ClickUp → campos CS Manager ─────────────────────

function interpretarWebhook(payload) {
  const evento = payload.event;
  const taskId = payload.task_id;
  if (!taskId) return null;

  // Mudança de status
  if (evento === 'taskStatusUpdated') {
    const hist = (payload.history_items || [])[0];
    const novoStatus = hist?.after?.status;
    if (!novoStatus) return null;
    const statusCSM = _statusCSM(novoStatus);
    if (!statusCSM) return null;
    return { tipo: 'status', taskId, statusCSM };
  }

  // Tarefa deletada no ClickUp
  if (evento === 'taskDeleted') {
    return { tipo: 'deletado', taskId };
  }

  return null;
}

module.exports = {
  isConfigurado,
  podeEnviar,
  criarTarefaAcao,
  atualizarTarefaAcao,
  excluirTarefaAcao,
  criarTarefaAlerta,
  criarTarefaReuniao,
  interpretarWebhook,
  _statusCSM,
};
