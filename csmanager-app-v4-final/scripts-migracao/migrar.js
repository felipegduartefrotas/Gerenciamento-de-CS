#!/usr/bin/env node
/**
 * Script de migração: traz dados do app standalone antigo (CS Manager v3,
 * que guardava tudo no localStorage do navegador) para o banco PostgreSQL
 * do CS Manager v4.
 *
 * COMO USAR:
 * 1. No app ANTIGO (CSManager_Creare_v3.html), clique em "Exportar backup".
 *    Isso baixa um arquivo .json (ex: csmanager_backup_18-06-2026.json).
 * 2. Copie esse arquivo para a mesma pasta deste script.
 * 3. Garanta que o backend novo (Postgres) já está rodando e acessível.
 * 4. Rode:
 *      cd scripts-migracao
 *      npm install pg
 *      DB_HOST=localhost DB_PORT=5432 DB_USER=csmanager DB_PASSWORD=sua_senha DB_NAME=csmanager \
 *        node migrar.js caminho/para/csmanager_backup_18-06-2026.json
 *
 *    Se estiver rodando isso de fora do servidor onde o Docker está, talvez
 *    precise expor a porta do Postgres temporariamente no docker-compose.yml
 *    (adicionar "ports: ['5432:5432']" no serviço "db") só durante a migração,
 *    e remover depois por segurança.
 *
 * O QUE ESTE SCRIPT FAZ:
 * - Lê o JSON de backup (estrutura antiga: chaves com valores brutos do localStorage)
 * - Para cada cliente antigo, cria um cliente novo no Postgres com um UUID novo
 * - Mantém um mapa "ID antigo -> UUID novo" para resolver as referências em
 *   reuniões, ações, NPS e timeline (que apontavam para o ID antigo do cliente)
 * - Migra reuniões, ações (Kanban), pesquisas de NPS e timeline, todos vinculados
 *   ao cliente certo
 * - É seguro rodar mais de uma vez? NÃO — ele sempre INSERE registros novos.
 *   Rodar duas vezes duplica todos os dados. Se precisar repetir, limpe as
 *   tabelas antes ou rode em um banco de testes primeiro.
 *
 * O QUE ESTE SCRIPT NÃO FAZ:
 * - Não migra usuários/senhas (o banco novo já vem com um usuário admin padrão,
 *   veja db-init/02_seed.sql — crie os demais usuários pela própria interface)
 * - Não migra áudios gravados (o app antigo guardava como base64 direto no
 *   localStorage; se isso for necessário, peça para tratarmos separadamente)
 * - Não migra configurações de alerta personalizadas (você pode reconfigurá-las
 *   na tela de Configurações do sistema novo em 2 minutos)
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const arquivoBackup = process.argv[2];
if (!arquivoBackup) {
  console.error('Uso: node migrar.js caminho/para/backup.json');
  process.exit(1);
}
if (!fs.existsSync(arquivoBackup)) {
  console.error(`Arquivo não encontrado: ${arquivoBackup}`);
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'csmanager',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'csmanager',
});

if (!process.env.DB_PASSWORD) {
  console.error('Defina DB_PASSWORD nas variáveis de ambiente antes de rodar.');
  process.exit(1);
}

// Os valores no JSON de backup antigo são strings brutas do localStorage —
// cada uma precisa ser parseada individualmente (não é um JSON único e estruturado).
function parseCampo(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function paraMaiusculo(v) {
  return typeof v === 'string' ? v.toUpperCase() : v;
}

async function main() {
  console.log(`Lendo backup: ${arquivoBackup}`);
  const backup = JSON.parse(fs.readFileSync(arquivoBackup, 'utf8'));

  const clientesAntigos = parseCampo(backup.clientes);
  const reunioesAntigas = parseCampo(backup.reunioes);
  const acoesAntigas = parseCampo(backup.acoes);
  const npsAntigos = parseCampo(backup.nps);
  const timelineAntiga = parseCampo(backup.timeline);

  console.log(`Encontrados: ${clientesAntigos.length} clientes, ${reunioesAntigas.length} reuniões, ${acoesAntigas.length} ações, ${npsAntigos.length} NPS, ${timelineAntiga.length} entradas de timeline.`);
  console.log('');

  const client = await pool.connect();
  const mapaIdCliente = new Map(); // ID antigo (ex: "cli_123") -> UUID novo do Postgres

  try {
    await client.query('BEGIN');

    // ── 1. CLIENTES ──
    console.log('Migrando clientes...');
    for (const c of clientesAntigos) {
      const { rows } = await client.query(
        `INSERT INTO clientes (
           empresa, nome_fantasia, cnpj, natureza_juridica, porte, situacao_rf, data_abertura, cnae,
           segmento, logradouro, numero, complemento, bairro, cidade, uf, regiao,
           contato, cargo, email, telefone, responsavel_cs, responsavel_comercial,
           tier, status, mensalidade_por_veiculo, taxa_adesao_por_veiculo, mrr, veiculos,
           inicio, data_assinatura, vigencia, produtos, health_score
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)
         RETURNING id`,
        [
          paraMaiusculo(c.empresa), paraMaiusculo(c.nomeFantasia), c.cnpj, paraMaiusculo(c.naturezaJuridica),
          paraMaiusculo(c.porte), paraMaiusculo(c.situacaoRF), c.dataAbertura || null, paraMaiusculo(c.cnae),
          paraMaiusculo(c.segmento), paraMaiusculo(c.logradouro), c.numero, paraMaiusculo(c.complemento),
          paraMaiusculo(c.bairro), paraMaiusculo(c.cidade), paraMaiusculo(c.uf), paraMaiusculo(c.regiao),
          paraMaiusculo(c.contato), paraMaiusculo(c.cargo), c.email, c.telefone,
          paraMaiusculo(c.responsavelCS), paraMaiusculo(c.responsavelComercial),
          paraMaiusculo(c.tier), paraMaiusculo(c.status) || 'Ativo',
          c.mensalidadePorVeiculo || null, c.taxaAdesaoPorVeiculo || null, c.mrr, c.veiculos,
          c.inicio || null, c.dataAssinatura || null, c.vigencia, paraMaiusculo(c.produtos), c.healthScore || 70,
        ]
      );
      mapaIdCliente.set(c.id, rows[0].id);
    }
    console.log(`  ${clientesAntigos.length} clientes migrados.`);

    // ── 2. REUNIÕES ──
    console.log('Migrando reuniões...');
    let reunioesMigradas = 0;
    for (const r of reunioesAntigas) {
      const novoClienteId = mapaIdCliente.get(r.clienteId);
      if (!novoClienteId) { console.warn(`  ⚠ Reunião "${r.tipo}" ignorada: cliente original não encontrado (clienteId antigo: ${r.clienteId})`); continue; }
      await client.query(
        `INSERT INTO reunioes (cliente_id, tipo, data_iso, csat, nps, sentimento, responsavel,
           participantes_creare, participantes_cliente, pontos_positivos, problemas_identificados,
           melhorias, proxima_reuniao, resumo_ia)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          novoClienteId, r.tipo, r.dataISO || new Date().toISOString(), r.csat, r.nps, r.sentimento, r.responsavel,
          JSON.stringify(r.participantesCreare || []), JSON.stringify(r.participantesCliente || []),
          r.pontosPosi, r.problemasIdent, r.melhorias, r.proximaReuniao, r.resumoIA,
        ]
      );
      reunioesMigradas++;
    }
    console.log(`  ${reunioesMigradas} reuniões migradas.`);

    // ── 3. AÇÕES (KANBAN) ──
    console.log('Migrando ações...');
    let acoesMigradas = 0;
    for (const a of acoesAntigas) {
      const novoClienteId = a.clienteId ? mapaIdCliente.get(a.clienteId) : null;
      if (a.clienteId && !novoClienteId) { console.warn(`  ⚠ Ação "${a.descricao}" ignorada: cliente original não encontrado.`); continue; }
      await client.query(
        `INSERT INTO acoes (cliente_id, descricao, area, prioridade, status, progresso, responsavel,
           prazo, prazo_iso, comentarios, categoria, reuniao_tipo, reuniao_data, reuniao_hora, reuniao_pauta,
           modalidade, reuniao_endereco, lat, lng, log)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          novoClienteId, paraMaiusculo(a.descricao), a.area, a.prioridade, a.status || 'Pendente', a.progresso || 0,
          paraMaiusculo(a.responsavel), a.prazo, a.prazoISO || null, paraMaiusculo(a.comentarios), a.categoria || null,
          a.reuniaoTipo || null, a.reuniaoData || null, a.reuniaoHora || null, paraMaiusculo(a.reuniaoPauta) || null,
          a.modalidade || null, a.reuniaoEndereco || null, a.lat || null, a.lng || null,
          JSON.stringify(a.log || []),
        ]
      );
      acoesMigradas++;
    }
    console.log(`  ${acoesMigradas} ações migradas.`);

    // ── 4. NPS ──
    console.log('Migrando pesquisas de NPS...');
    let npsMigrados = 0;
    for (const n of npsAntigos) {
      const novoClienteId = mapaIdCliente.get(n.clienteId);
      if (!novoClienteId) { console.warn(`  ⚠ NPS ${n.nota}/10 ignorado: cliente original não encontrado.`); continue; }
      await client.query(
        `INSERT INTO nps (cliente_id, nota, respondente, cargo, comentario, data_iso, cs)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [novoClienteId, n.nota, paraMaiusculo(n.respondente), paraMaiusculo(n.cargo), paraMaiusculo(n.comentario), n.dataISO || new Date().toISOString(), n.cs]
      );
      npsMigrados++;
    }
    console.log(`  ${npsMigrados} pesquisas de NPS migradas.`);

    // ── 5. TIMELINE ──
    console.log('Migrando timeline...');
    let timelineMigrada = 0;
    for (const t of timelineAntiga) {
      const novoClienteId = mapaIdCliente.get(t.clienteId);
      if (!novoClienteId) continue; // timeline sem cliente correspondente não é migrável, silenciosamente ignorada
      await client.query(
        `INSERT INTO timeline (cliente_id, tipo, titulo, descricao, usuario, data_iso, editado, historico)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [novoClienteId, t.tipo, t.titulo, t.descricao, t.usuario, t.dataISO || new Date().toISOString(), !!t.editado, JSON.stringify(t.historico || [])]
      );
      timelineMigrada++;
    }
    console.log(`  ${timelineMigrada} entradas de timeline migradas.`);

    // ── 6. RECALCULAR HEALTH SCORE de todos os clientes migrados ──
    // (o health_score importado é só o que estava salvo; recalcular garante
    // consistência com reuniões/NPS recém-migrados)
    console.log('Recalculando Health Score de todos os clientes migrados...');
    let recalculados = 0;
    for (const [, novoId] of mapaIdCliente) {
      await recalcularHealthScore(client, novoId);
      recalculados++;
    }
    console.log(`  ${recalculados} clientes com Health Score recalculado.`);

    await client.query('COMMIT');
    console.log('');
    console.log('✓ Migração concluída com sucesso! Todas as alterações foram salvas.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('');
    console.error('❌ ERRO durante a migração — nenhuma alteração foi salva (rollback completo):');
    console.error(e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Mesma lógica de cálculo usada pelo backend (routes/reunioes.js), reaplicada aqui
// para que os clientes migrados já tenham um Health Score consistente desde o início.
async function recalcularHealthScore(client, clienteId) {
  const reunioes = await client.query('SELECT * FROM reunioes WHERE cliente_id = $1 ORDER BY data_iso DESC', [clienteId]);
  const acoes = await client.query("SELECT * FROM acoes WHERE cliente_id = $1 AND status != 'Concluído'", [clienteId]);
  const npsRows = await client.query('SELECT * FROM nps WHERE cliente_id = $1', [clienteId]);
  const clienteRes = await client.query('SELECT * FROM clientes WHERE id = $1', [clienteId]);
  if (!clienteRes.rows.length) return;
  const c = clienteRes.rows[0];
  const re = reunioes.rows;
  const now = new Date();

  let s = 70;
  if (re.length > 0) {
    const d = Math.floor((now - new Date(re[0].data_iso)) / 86400000);
    if (d <= 15) s += 10; else if (d <= 30) s += 5; else if (d <= 45) s -= 5; else if (d <= 60) s -= 15; else s -= 25;
  } else s -= 20;

  if (re.length > 0) {
    const cm = re.slice(0, 3).reduce((t, r) => t + (r.csat || 7), 0) / Math.min(re.length, 3);
    if (cm >= 9) s += 10; else if (cm >= 7) s += 5; else if (cm >= 5) s -= 5; else s -= 15;
  }

  let ultimoNps = c.ultimo_nps;
  if (npsRows.rows.length > 0) {
    const notas = npsRows.rows.map(n => n.nota);
    const prom = notas.filter(n => n >= 9).length, det = notas.filter(n => n <= 6).length;
    const score = Math.round(((prom - det) / notas.length) * 100);
    if (score >= 75) s += 15; else if (score >= 50) s += 8; else if (score >= 25) s += 2; else if (score >= 0) s -= 8; else s -= 18;
    ultimoNps = score;
  }

  const atrasadas = acoes.rows.filter(a => a.prazo_iso && new Date(a.prazo_iso) < now);
  s -= Math.min(atrasadas.length * 5, 20);

  if (c.status === 'Expansão') s += 8;
  if (c.status === 'Em Risco') s -= 15;
  if (c.status === 'Implantação') s -= 5;

  const healthScore = Math.max(0, Math.min(100, Math.round(s)));
  await client.query('UPDATE clientes SET health_score = $1, ultimo_nps = $2 WHERE id = $3', [healthScore, ultimoNps, clienteId]);
}

if (require.main === module) {
  main();
}
module.exports = { main };
