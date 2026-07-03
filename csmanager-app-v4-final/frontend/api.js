// ════════════════════════════════════════════════════════════
// CS_DB — agora fala com a API real (backend + PostgreSQL)
// em vez de localStorage. Mantém os MESMOS nomes de métodos
// que o restante do app já usa, para não precisar reescrever
// as centenas de chamadas existentes no resto do código.
//
// Estratégia: cache em memória populado no login/refresh,
// para que as funções de LEITURA continuem síncronas (como
// o app espera). Funções de ESCRITA são assíncronas (Promise)
// e quem as chama precisa usar .then()/await — os poucos
// pontos que precisam disso foram ajustados no restante do código.
// ════════════════════════════════════════════════════════════

const API_BASE = (window.CSM_API_BASE || '/api');

const CS_DB = {
  VERSION: '4.0-api',
  _cache: { clientes: [], reunioes: [], acoes: [], nps: [], timeline: {}, alertas: [], config: {}, grupos: [] },
  _token: null,
  _usuario: null,

  // ── infraestrutura HTTP ──────────────────────────────────
  async _fetch(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (this._token) headers['Authorization'] = `Bearer ${this._token}`;
    const r = await fetch(API_BASE + path, { ...opts, headers });
    if (r.status === 401) {
      this.clearSession();
      window.location.reload();
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.erro || 'Erro na requisição.');
    return data;
  },

  // ── sessão / autenticação ────────────────────────────────
  async login(email, senha) {
    const data = await this._fetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
    this._token = data.token;
    this._usuario = data.usuario;
    sessionStorage.setItem('csm_token', data.token);
    sessionStorage.setItem('csm_usuario', JSON.stringify(data.usuario));
    return data.usuario;
  },
  getSession() {
    if (this._usuario) return this._usuario;
    const tok = sessionStorage.getItem('csm_token');
    const usr = sessionStorage.getItem('csm_usuario');
    if (tok && usr) {
      this._token = tok;
      this._usuario = JSON.parse(usr);
      return this._usuario;
    }
    return null;
  },
  saveSession(d) { /* compat: sessão real é controlada por login(), isto é só placeholder */ },
  clearSession() {
    this._token = null;
    this._usuario = null;
    sessionStorage.removeItem('csm_token');
    sessionStorage.removeItem('csm_usuario');
  },

  // ── carregamento inicial (popula o cache de uma vez) ─────
  async carregarTudo() {
    const [clientes, reunioes, acoes, nps, alertas, grupos] = await Promise.all([
      this._fetch('/clientes'),
      this._fetch('/reunioes'),
      this._fetch('/acoes'),
      this._fetch('/nps'),
      this._fetch('/alertas'),
      this._fetch('/grupos'),
    ]);
    this._cache.clientes = clientes.map(this._normalizarCliente);
    this._cache.reunioes = reunioes.map(this._normalizarReuniao);
    this._cache.acoes = acoes.map(this._normalizarAcao);
    this._cache.nps = nps.map(this._normalizarNps);
    this._cache.alertas = alertas;
    this._cache.grupos = grupos;
    // Chaves de armazenamento genérico usadas por módulos ainda não totalmente migrados
    await Promise.all([
      this._carregarKv('onboardings'),
      this._carregarKv('lastBackup'),
      this._carregarKv('emailTemplates'),
      this._carregarKv('atas'),
      this._carregarKv('churns'),
      this._carregarKv('voc'),
    ]);
    try {
      this._cache.config = await this._fetch('/config');
    } catch { this._cache.config = {}; }
  },

  // ── normalização snake_case (Postgres) → camelCase (frontend) ─
  _normalizarCliente(c) {
    return {
      id: c.id, empresa: c.empresa, nomeFantasia: c.nome_fantasia, cnpj: c.cnpj,
      grupoId: c.grupo_id, tipoNoGrupo: c.tipo_no_grupo,
      naturezaJuridica: c.natureza_juridica, porte: c.porte, situacaoRF: c.situacao_rf,
      dataAbertura: c.data_abertura, cnae: c.cnae, segmento: c.segmento,
      logradouro: c.logradouro, numero: c.numero, complemento: c.complemento, bairro: c.bairro,
      cidade: c.cidade, uf: c.uf, regiao: c.regiao, contato: c.contato, cargo: c.cargo,
      email: c.email, telefone: c.telefone, responsavelCS: c.responsavel_cs,
      responsavelComercial: c.responsavel_comercial, tier: c.tier, status: c.status,
      mensalidadePorVeiculo: c.mensalidade_por_veiculo, taxaAdesaoPorVeiculo: c.taxa_adesao_por_veiculo,
      mrr: c.mrr, veiculos: c.veiculos, inicio: c.inicio, dataAssinatura: c.data_assinatura,
      vigencia: c.vigencia, produtos: c.produtos, healthScore: c.health_score, ultimoNPS: c.ultimo_nps,
      dataRenovacao: c.data_renovacao, renovacao: c.renovacao,
      ultimaAlteracaoEm: c.ultima_alteracao_em, ultimaAlteracaoPor: c.ultima_alteracao_por,
      criadoEm: c.criado_em, atualizadoEm: c.atualizado_em,
    };
  },
  // Padroniza texto em MAIÚSCULAS — aplicado a todo o sistema para manter consistência
  // (nomes, endereços, observações, etc.), exceto e-mail (mantido como digitado).
  _paraMaiusculo(valor) {
    if (typeof valor !== 'string') return valor;
    return valor.toUpperCase();
  },
  _normalizarTextoCliente(c) {
    const camposTexto = ['empresa','nomeFantasia','naturezaJuridica','porte','situacaoRF','cnae','segmento',
      'logradouro','numero','complemento','bairro','cidade','uf','regiao','contato','cargo','telefone',
      'responsavelCS','responsavelComercial','tier','status','produtos'];
    const normalizado = { ...c };
    camposTexto.forEach(campo => {
      if (typeof normalizado[campo] === 'string') normalizado[campo] = this._paraMaiusculo(normalizado[campo]);
    });
    return normalizado;
  },
  _converterClienteParaApi(c) {
    return {
      empresa: c.empresa, nome_fantasia: c.nomeFantasia, cnpj: c.cnpj,
      natureza_juridica: c.naturezaJuridica, porte: c.porte, situacao_rf: c.situacaoRF,
      data_abertura: c.dataAbertura, cnae: c.cnae, segmento: c.segmento,
      logradouro: c.logradouro, numero: c.numero, complemento: c.complemento, bairro: c.bairro,
      cidade: c.cidade, uf: c.uf, regiao: c.regiao, contato: c.contato, cargo: c.cargo,
      email: c.email, telefone: c.telefone, responsavel_cs: c.responsavelCS,
      responsavel_comercial: c.responsavelComercial, tier: c.tier, status: c.status,
      mensalidade_por_veiculo: c.mensalidadePorVeiculo || null, taxa_adesao_por_veiculo: c.taxaAdesaoPorVeiculo || null,
      mrr: c.mrr, veiculos: c.veiculos, inicio: c.inicio, data_assinatura: c.dataAssinatura,
      vigencia: c.vigencia, produtos: c.produtos, health_score: c.healthScore,
      data_renovacao: c.dataRenovacao || null, renovacao: c.renovacao,
      grupo_id: c.grupoId || null, tipo_no_grupo: c.tipoNoGrupo || null,
    };
  },
  _normalizarReuniao(r) {
    return {
      id: r.id, clienteId: r.cliente_id, empresa: r.empresa, tipo: r.tipo,
      dataISO: r.data_iso, data: r.data_iso ? new Date(r.data_iso).toLocaleDateString('pt-BR') : '',
      csat: r.csat, nps: r.nps, sentimento: r.sentimento, responsavel: r.responsavel,
      participantesCreare: r.participantes_creare, participantesCliente: r.participantes_cliente,
      pontosPosi: r.pontos_positivos, problemasIdent: r.problemas_identificados,
      melhorias: r.melhorias, proximaReuniao: r.proxima_reuniao, resumoIA: r.resumo_ia,
    };
  },
  _normalizarAcao(a) {
    return {
      id: a.id, clienteId: a.cliente_id, empresa: a.empresa, descricao: a.descricao, area: a.area,
      prioridade: a.prioridade, status: a.status, progresso: a.progresso, responsavel: a.responsavel,
      prazo: a.prazo, prazoISO: a.prazo_iso, comentarios: a.comentarios, categoria: a.categoria,
      reuniaoTipo: a.reuniao_tipo, reuniaoData: a.reuniao_data, reuniaoHora: a.reuniao_hora,
      reuniaoPauta: a.reuniao_pauta, modalidade: a.modalidade, reuniaoEndereco: a.reuniao_endereco,
      lat: a.lat ? parseFloat(a.lat) : null, lng: a.lng ? parseFloat(a.lng) : null,
      log: a.log || [], criadoEm: a.criado_em, criadoPor: a.criado_por,
      ultimaAlteracaoEm: a.ultima_alteracao_em, ultimaAlteracaoPor: a.ultima_alteracao_por,
    };
  },
  _normalizarNps(n) {
    return {
      id: n.id, clienteId: n.cliente_id, empresa: n.empresa, nota: n.nota,
      respondente: n.respondente, cargo: n.cargo, comentario: n.comentario,
      dataISO: n.data_iso, data: n.data_iso ? new Date(n.data_iso).toLocaleDateString('pt-BR') : '',
      cs: n.cs,
    };
  },

  // ── CLIENTES ──────────────────────────────────────────────
  getClientes(f = {}) {
    let l = this._cache.clientes;
    if (f.status) l = l.filter(c => c.status === f.status);
    if (f.tier) l = l.filter(c => c.tier === f.tier);
    if (f.hs === 'alto') l = l.filter(c => c.healthScore >= 70);
    if (f.hs === 'medio') l = l.filter(c => c.healthScore >= 40 && c.healthScore < 70);
    if (f.hs === 'baixo') l = l.filter(c => c.healthScore < 40);
    if (f.q) l = l.filter(c => c.empresa.toLowerCase().includes(f.q.toLowerCase()) || (c.cnpj || '').includes(f.q));
    return l;
  },
  getClienteById(id) { return this._cache.clientes.find(c => c.id === id) || null; },
  async saveCliente(c) {
    const cNormalizado = this._normalizarTextoCliente(c);
    const payload = this._converterClienteParaApi(cNormalizado);
    let salvo;
    if (!c.id) {
      salvo = await this._fetch('/clientes', { method: 'POST', body: JSON.stringify(payload) });
      this._cache.clientes.push(this._normalizarCliente(salvo));
    } else {
      salvo = await this._fetch(`/clientes/${c.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      const idx = this._cache.clientes.findIndex(x => x.id === c.id);
      const norm = this._normalizarCliente(salvo);
      if (idx >= 0) this._cache.clientes[idx] = norm; else this._cache.clientes.push(norm);
    }
    Object.assign(c, this._normalizarCliente(salvo)); // mantém o objeto original atualizado (id, etc.)
    return c;
  },
  async deleteCliente(id) {
    await this._fetch(`/clientes/${id}`, { method: 'DELETE' });
    this._cache.clientes = this._cache.clientes.filter(c => c.id !== id);
  },

  // ── REUNIÕES ──────────────────────────────────────────────
  getAllReunioes() { return [...this._cache.reunioes].sort((a, b) => new Date(b.dataISO) - new Date(a.dataISO)); },
  getReunioesCliente(cid) { return this._cache.reunioes.filter(r => r.clienteId === cid).sort((a, b) => new Date(b.dataISO) - new Date(a.dataISO)); },
  async saveReuniao(r) {
    const payload = {
      cliente_id: r.clienteId, tipo: r.tipo, csat: r.csat, nps: r.nps, sentimento: r.sentimento,
      participantes_creare: r.participantesCreare, participantes_cliente: r.participantesCliente,
      pontos_positivos: this._paraMaiusculo(r.pontosPosi), problemas_identificados: this._paraMaiusculo(r.problemasIdent),
      melhorias: this._paraMaiusculo(r.melhorias), proxima_reuniao: r.proximaReuniao, resumo_ia: r.resumoIA,
    };
    const salvo = await this._fetch('/reunioes', { method: 'POST', body: JSON.stringify(payload) });
    const norm = this._normalizarReuniao(salvo);
    this._cache.reunioes.push(norm);
    await this._atualizarClienteNoCache(r.clienteId);
    await this._recarregarTimelineCliente(r.clienteId);
    return norm;
  },

  // ── AÇÕES (Kanban) ────────────────────────────────────────
  getAllAcoes(f = {}) {
    let l = this._cache.acoes;
    if (f.status) l = l.filter(a => a.status === f.status);
    const po = { Alta: 0, Média: 1, Baixa: 2 };
    return [...l].sort((a, b) => (po[a.prioridade] ?? 1) - (po[b.prioridade] ?? 1));
  },
  getAcoesCliente(cid) { return this._cache.acoes.filter(a => a.clienteId === cid); },
  async saveAcao(a) {
    const payload = {
      cliente_id: a.clienteId, descricao: this._paraMaiusculo(a.descricao), area: a.area, prioridade: a.prioridade,
      status: a.status, progresso: a.progresso, responsavel: this._paraMaiusculo(a.responsavel), prazo: a.prazo,
      prazo_iso: a.prazoISO, comentarios: this._paraMaiusculo(a.comentarios), categoria: a.categoria,
      reuniao_tipo: a.reuniaoTipo, reuniao_data: a.reuniaoData, reuniao_hora: a.reuniaoHora,
      reuniao_pauta: this._paraMaiusculo(a.reuniaoPauta),
    };
    let salvo;
    if (!a.id) {
      salvo = await this._fetch('/acoes', { method: 'POST', body: JSON.stringify(payload) });
      this._cache.acoes.push(this._normalizarAcao(salvo));
    } else {
      salvo = await this._fetch(`/acoes/${a.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      const idx = this._cache.acoes.findIndex(x => x.id === a.id);
      if (idx >= 0) this._cache.acoes[idx] = this._normalizarAcao(salvo);
    }
    Object.assign(a, this._normalizarAcao(salvo));
    if (a.clienteId) await this._recarregarTimelineCliente(a.clienteId);
    return a;
  },
  async atualizarStatusAcao(id, status, encerrado = false) {
    const salvo = await this._fetch(`/acoes/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, encerrado }) });
    const norm = this._normalizarAcao(salvo);
    const idx = this._cache.acoes.findIndex(x => x.id === id);
    if (idx >= 0) this._cache.acoes[idx] = norm;
    if (norm.clienteId) await this._recarregarTimelineCliente(norm.clienteId);
    return norm;
  },
  async deleteAcao(id) {
    await this._fetch(`/acoes/${id}`, { method: 'DELETE' });
    this._cache.acoes = this._cache.acoes.filter(a => a.id !== id);
  },

  // ── NPS ───────────────────────────────────────────────────
  getAllNPS() { return [...this._cache.nps].sort((a, b) => new Date(b.dataISO) - new Date(a.dataISO)); },
  getNPSCliente(cid) { return this._cache.nps.filter(n => n.clienteId === cid).sort((a, b) => new Date(b.dataISO) - new Date(a.dataISO)); },
  async saveNPS(p) {
    const payload = { cliente_id: p.clienteId, nota: p.nota, respondente: this._paraMaiusculo(p.respondente), cargo: this._paraMaiusculo(p.cargo), comentario: this._paraMaiusculo(p.comentario) };
    const salvo = await this._fetch('/nps', { method: 'POST', body: JSON.stringify(payload) });
    const norm = this._normalizarNps(salvo);
    this._cache.nps.push(norm);
    await this._atualizarClienteNoCache(p.clienteId);
    await this._recarregarTimelineCliente(p.clienteId);
    return norm;
  },
  calcNPS(ps) {
    if (!ps || !ps.length) return { score: null, promotores: 0, neutros: 0, detratores: 0, total: 0, promPct: 0, neuPct: 0, detPct: 0 };
    const t = ps.length, p = ps.filter(x => x.nota >= 9).length, n = ps.filter(x => x.nota >= 7 && x.nota <= 8).length, d = ps.filter(x => x.nota <= 6).length;
    const pp = Math.round(p / t * 100), np = Math.round(n / t * 100), dp = 100 - pp - np;
    return { score: pp - dp, promotores: p, neutros: n, detratores: d, total: t, promPct: pp, neuPct: np, detPct: dp };
  },
  npsZona(s) {
    if (s === null || s === undefined) return { label: 'Sem dados', classe: 'gray', emoji: '—', range: '—' };
    if (s <= 0) return { label: 'Zona Crítica', classe: 'crit', emoji: '🚨', range: '−100 a 0', cor: '#a32d2d', bg: '#fcebeb' };
    if (s <= 49) return { label: 'Zona de Aperfeiçoamento', classe: 'aperf', emoji: '⚠️', range: '1 a 49', cor: '#8a6000', bg: '#fff3cd' };
    if (s <= 74) return { label: 'Zona de Qualidade', classe: 'qual', emoji: '🎯', range: '50 a 74', cor: '#1a4fa0', bg: '#e8f0fd' };
    return { label: 'Zona de Excelência', classe: 'excel', emoji: '🏆', range: '75 a 100', cor: '#1d9e75', bg: '#e1f5ee' };
  },

  // ── TIMELINE ──────────────────────────────────────────────
  getTimeline(cid) { return this._cache.timeline[cid] || []; },
  async _recarregarTimelineCliente(cid) {
    if (!cid) return;
    const rows = await this._fetch(`/timeline/cliente/${cid}`);
    this._cache.timeline[cid] = rows.map(t => ({
      id: t.id, clienteId: t.cliente_id, tipo: t.tipo, titulo: t.titulo, descricao: t.descricao,
      usuario: t.usuario, dataISO: t.data_iso, data: new Date(t.data_iso).toLocaleDateString('pt-BR'),
      editado: t.editado, ultimaEdicaoEm: t.ultima_edicao_em, historico: t.historico || [],
    }));
  },
  async _addTimeline(cid, tipo, titulo, desc) {
    if (!cid) return;
    // Entradas de "comentario" são texto livre digitado pelo usuário — padroniza em maiúsculas.
    // Demais tipos (sistema, acao, reuniao, nps, email) já vêm formatados pelo próprio app e não são alterados.
    const descFinal = tipo === 'comentario' ? this._paraMaiusculo(desc) : desc;
    await this._fetch('/timeline', { method: 'POST', body: JSON.stringify({ cliente_id: cid, tipo, titulo, descricao: descFinal }) });
    await this._recarregarTimelineCliente(cid);
  },
  async editarItemTimeline(id, cid, titulo, descricao) {
    await this._fetch(`/timeline/${id}`, { method: 'PUT', body: JSON.stringify({ titulo, descricao: this._paraMaiusculo(descricao) }) });
    await this._recarregarTimelineCliente(cid);
  },

  // ── ALERTAS ───────────────────────────────────────────────
  getAlertas() { return this._cache.alertas; },
  async _gerarAlertas() {
    this._cache.alertas = await this._fetch('/alertas');
    return this._cache.alertas;
  },
  async dismissAlerta(alertaId) {
    await this._fetch(`/alertas/${alertaId}/dismiss`, { method: 'POST' });
    this._cache.alertas = this._cache.alertas.filter(a => a.id !== alertaId);
  },

  // ── auxiliar: recarrega 1 cliente do servidor após operação que muda health score ──
  async _atualizarClienteNoCache(cid) {
    if (!cid) return;
    const c = await this._fetch(`/clientes/${cid}`);
    const idx = this._cache.clientes.findIndex(x => x.id === cid);
    if (idx >= 0) this._cache.clientes[idx] = this._normalizarCliente(c);
  },
  async _recalcHS(cid) { await this._atualizarClienteNoCache(cid); }, // compat: recálculo já é feito no backend

  // ── GRUPOS ECONÔMICOS ─────────────────────────────────────
  getGrupos() { return this._cache.grupos; },
  getGrupoById(id) { return this._cache.grupos.find(g => g.id === id) || null; },
  async getGrupoDetalhe(id) { return this._fetch(`/grupos/${id}`); },
  async saveGrupo(g) {
    let salvo;
    if (!g.id) {
      salvo = await this._fetch('/grupos', { method: 'POST', body: JSON.stringify(g) });
      this._cache.grupos.push(salvo);
    } else {
      salvo = await this._fetch(`/grupos/${g.id}`, { method: 'PUT', body: JSON.stringify(g) });
      const idx = this._cache.grupos.findIndex(x => x.id === g.id);
      if (idx >= 0) this._cache.grupos[idx] = salvo; else this._cache.grupos.push(salvo);
    }
    return salvo;
  },
  async deleteGrupo(id) {
    await this._fetch(`/grupos/${id}`, { method: 'DELETE' });
    this._cache.grupos = this._cache.grupos.filter(g => g.id !== id);
    this._cache.clientes.forEach(c => { if (c.grupoId === id) { c.grupoId = null; c.tipoNoGrupo = null; } });
  },

  // ── HISTÓRICO HEALTH SCORE ────────────────────────────────
  async getHsHistorico(clienteId) {
    return this._fetch(`/hs-historico/${clienteId}`);
  },

  // ── DOCUMENTOS ────────────────────────────────────────────
  async getDocs(clienteId) {
    return this._fetch(`/docs?cliente_id=${clienteId}`);
  },
  async addDoc({ clienteId, nome, categoria, tamanhoKB, tipo, base64, dataDoc, nota }) {
    return this._fetch('/docs', { method: 'POST', body: JSON.stringify({
      cliente_id: clienteId, nome, categoria, tamanho_kb: tamanhoKB, tipo, base64, data_doc: dataDoc, nota,
    }) });
  },
  async getDocFull(id) {
    return this._fetch(`/docs/${id}`);
  },
  async deleteDoc(id) {
    return this._fetch(`/docs/${id}`, { method: 'DELETE' });
  },

  // ── CSAT ──────────────────────────────────────────────────
  async getCSAT(clienteId) {
    if (clienteId) return this._fetch(`/csat?cliente_id=${clienteId}`);
    return this._fetch('/csat');
  },
  async getCSATGeral() {
    return this._fetch('/csat/geral');
  },
  async getCSATCalculo(clienteId) {
    return this._fetch(`/csat/cliente/${clienteId}/calculo`);
  },
  async addCSAT({ clienteId, nota, tipoInteracao, respondente, cargo, comentario }) {
    return this._fetch('/csat', { method: 'POST', body: JSON.stringify({
      cliente_id: clienteId, nota, tipo_interacao: tipoInteracao, respondente, cargo, comentario,
    }) });
  },
  async deleteCSAT(id) {
    return this._fetch(`/csat/${id}`, { method: 'DELETE' });
  },

  // ── WEBHOOK ───────────────────────────────────────────────
  async dispararWebhook() {
    return this._fetch('/alertas/disparar-webhook', { method: 'POST' });
  },

  // ── TROCA DE SENHA ────────────────────────────────────────
  async trocarSenha(senhaAtual, novaSenha) {
    return this._fetch('/auth/trocar-senha', { method: 'POST', body: JSON.stringify({ senhaAtual, novaSenha }) });
  },

  // ── EXPORTAÇÃO CSV REUNIÕES ───────────────────────────────
  exportarCSVReunioes() {
    const re = this._cache.reunioes;
    const cl = new Map(this._cache.clientes.map(c => [c.id, c.empresa]));
    const cols = ['empresa','data','tipo','csat','obs','responsavel'];
    const labels = ['Empresa','Data','Tipo','CSAT','Observações','Responsável'];
    const esc = v => { if(v===null||v===undefined)return''; const s=String(v); return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:`${s}`; };
    const rows = [labels.join(',')];
    re.forEach(r => rows.push([cl.get(r.clienteId)||'',r.data||'',r.tipo||'',r.csat??'',r.obs||'',r.responsavel||''].map(esc).join(',')));
    const bl = new Blob(['﻿'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
    const u = URL.createObjectURL(bl);
    const a = document.createElement('a');a.href=u;a.download=`reunioes_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.csv`;a.click();URL.revokeObjectURL(u);
  },

  // ── EXPORTAÇÃO CSV NPS ────────────────────────────────────
  exportarCSVNPS() {
    const np = this._cache.nps;
    const cl = new Map(this._cache.clientes.map(c => [c.id, c.empresa]));
    const cols = ['empresa','data','nota','comentario','responsavel'];
    const labels = ['Empresa','Data','Nota','Comentário','Responsável'];
    const esc = v => { if(v===null||v===undefined)return''; const s=String(v); return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:`${s}`; };
    const rows = [labels.join(',')];
    np.forEach(n => rows.push([cl.get(n.clienteId)||'',n.data||'',n.nota??'',n.comentario||'',n.responsavel||''].map(esc).join(',')));
    const bl = new Blob(['﻿'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
    const u = URL.createObjectURL(bl);
    const a = document.createElement('a');a.href=u;a.download=`nps_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.csv`;a.click();URL.revokeObjectURL(u);
  },

  // ── EXPORTAÇÃO CSV ────────────────────────────────────────
  exportarCSV(clientes) {
    const cols = ['empresa','nomeFantasia','cnpj','segmento','tier','status','healthScore',
                  'mrr','veiculos','mensalidadePorVeiculo','contato','cargo','email',
                  'telefone','responsavelCS','cidade','uf','renovacao'];
    const labels = ['Razão Social','Nome Fantasia','CNPJ','Segmento','Tier','Status',
                    'Health Score','MRR','Veículos','Mensalidade/Veículo','Contato','Cargo',
                    'E-mail','Telefone','Responsável CS','Cidade','UF','Renovação'];
    const esc = v => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s;
    };
    const rows = [labels.join(',')];
    (clientes || this._cache.clientes).forEach(c => {
      rows.push(cols.map(k => esc(c[k])).join(','));
    });
    const bl = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const u = URL.createObjectURL(bl);
    const a = document.createElement('a');
    a.href = u; a.download = `clientes_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.csv`;
    a.click();
    URL.revokeObjectURL(u);
  },

  // ── CONFIG ────────────────────────────────────────────────
  getConfig() { return this._cache.config; },
  async saveConfig(c) {
    this._cache.config = c;
    await this._fetch('/config', { method: 'PUT', body: JSON.stringify(c) });
  },

  // ── ESTATÍSTICAS (dashboard) ──────────────────────────────
  getStats() {
    const cl = this._cache.clientes, re = this._cache.reunioes, ac = this._cache.acoes, np = this._cache.nps, now = new Date();
    return {
      totalClientes: cl.length, clientesAtivos: cl.filter(c => c.status === 'Ativo').length,
      clientesRisco: cl.filter(c => c.status === 'Em Risco').length,
      hsMedia: cl.length ? Math.round(cl.reduce((s, c) => s + (c.healthScore || 70), 0) / cl.length) : 0,
      reunioesTotal: re.length, acoesTotal: ac.length,
      acoesConcluidas: ac.filter(a => a.status === 'Concluído').length,
      acoesAtrasadas: ac.filter(a => a.status !== 'Concluído' && a.prazoISO && new Date(a.prazoISO) < now).length,
      npsTotal: np.length, npsMedia: np.length ? this.calcNPS(np).score : null,
    };
  },

  // ── ÁUDIOS ────────────────────────────────────────────────
  async salvarAudio(clienteId, dataBase64, duracao, tamanhoKB, reuniaoId = null, titulo = null) {
    return this._fetch('/audios', { method: 'POST', body: JSON.stringify({ cliente_id: clienteId, reuniao_id: reuniaoId, titulo, data_base64: dataBase64, duracao, tamanho_kb: tamanhoKB }) });
  },
  async buscarAudio(audioId) {
    return this._fetch(`/audios/${audioId}`);
  },
  async listarAudios({ clienteId, reuniaoId }) {
    const q = clienteId ? `cliente_id=${clienteId}` : `reuniao_id=${reuniaoId}`;
    return this._fetch(`/audios?${q}`);
  },
  async deletarAudio(audioId) {
    return this._fetch(`/audios/${audioId}`, { method: 'DELETE' });
  },

  // ── ARMAZENAMENTO GENÉRICO (compat. com módulos ainda não migrados,
  //     ex.: onboarding — persiste de verdade no Postgres via /api/kv) ──
  _kvCache: {},
  get(chave) {
    return this._kvCache[chave] ?? null;
  },
  async set(chave, valor) {
    this._kvCache[chave] = valor;
    await this._fetch(`/kv/${chave}`, { method: 'PUT', body: JSON.stringify({ valor }) });
    return true;
  },
  async _carregarKv(chave) {
    const valor = await this._fetch(`/kv/${chave}`);
    this._kvCache[chave] = valor;
    return valor;
  },

  // ── BACKUP (agora exporta do servidor, não do localStorage) ──
  async exportarTudo() {
    const dados = { clientes: this._cache.clientes, reunioes: this._cache.reunioes, acoes: this._cache.acoes, nps: this._cache.nps };
    const bl = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(bl);
    const a = document.createElement('a');
    a.href = u; a.download = `csmanager_backup_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(u);
  },
};

window.CS_DB = CS_DB;
