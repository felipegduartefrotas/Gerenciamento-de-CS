# Skill: Arquitetura do CS Manager

Referência completa da arquitetura do sistema para uso em qualquer sessão de desenvolvimento.

---

## Visão Geral

O CS Manager é uma plataforma de Customer Success da **Creare Sistemas** (telemetria, videomonitoramento e segurança para frotas). Gerencia carteira B2B: frotas, transporte, logística, mineração, agronegócio.

Existem **duas versões vivas em paralelo**:

| Versão | Local | Banco | Deploy |
|--------|-------|-------|--------|
| v3 Standalone | `index.html` (raiz do repo) | localStorage | GitHub Pages |
| v4 Full-Stack | `csmanager-app-v4-final/` | PostgreSQL 16 | Docker Compose |

> **Regra crítica:** features novas pedidas pelo usuário são aplicadas no v3 (`index.html`). A migração para v4 é um trabalho separado com `/migrar-v3-v4`.

---

## Estrutura de Pastas

```
C:\Users\Delta\FFKD\
├── CRM/                         # Produto separado (Easy Fleet / Carro Verificado)
│   └── docs/index.html
│
└── Gerenciamento-de-CS/         # Repo: felipegduartefrotas/Gerenciamento-de-CS
    ├── index.html               # <<< V3 STANDALONE — arquivo de trabalho principal
    ├── README.md
    └── csmanager-app-v4-final/
        ├── docker-compose.yml
        ├── .env.example
        ├── db-init/
        │   ├── 01_schema.sql    # Schema PostgreSQL completo
        │   └── 02_seed.sql      # Usuário admin inicial
        ├── frontend/
        │   ├── index.html       # V4 frontend (usa api.js)
        │   ├── api.js           # CS_DB object — abstração da API REST
        │   ├── sw.js            # Service Worker (PWA)
        │   └── nginx.conf       # Proxy reverso → backend:3001
        ├── backend/
        │   └── src/
        │       ├── server.js    # Express, porta 3001 (interna Docker)
        │       ├── db/
        │       │   ├── pool.js       # Pool PostgreSQL (pg)
        │       │   └── jsonbUtil.js  # comoArray() para campos JSONB
        │       ├── middleware/
        │       │   └── auth.js      # JWT + exigirAdmin
        │       └── routes/
        │           ├── auth.js      # POST /api/auth/login
        │           ├── usuarios.js  # CRUD usuários (admin only)
        │           ├── clientes.js  # CRUD clientes + Health Score
        │           ├── reunioes.js  # CRUD reuniões realizadas
        │           ├── acoes.js     # CRUD ações Kanban + reuniões agendadas
        │           ├── nps.js       # CRUD NPS
        │           ├── timeline.js  # GET + PATCH (edição com histórico)
        │           ├── alertas.js   # GET dinâmico + POST dismiss (7 dias)
        │           ├── audios.js    # POST/GET áudios base64
        │           ├── kv.js        # GET/PUT chave-valor (≤1MB)
        │           └── config.js    # Configurações globais
        └── scripts-migracao/
            └── migrar.js        # Script Node.js para migrar localStorage → PostgreSQL
```

---

## Stack Técnica (v4)

- **Backend:** Node.js + Express 4, PostgreSQL 16, JWT (12h), bcrypt, express-rate-limit
- **Frontend:** HTML estático + api.js (objeto CS_DB), CSS inline (sem framework)
- **Orquestração:** Docker Compose 3 serviços: `db`, `backend`, `frontend`
- **Rede:** Frontend exposto na porta 80. Backend na 3001 apenas na rede Docker interna.
- **Persistência:** Volume Docker `csmanager_db_data` (sobrevive a `down`)

## Stack Técnica (v3)

- **Tudo em um arquivo:** `index.html` (~8000+ linhas)
- **Banco de dados:** `localStorage` via objeto `CS_DB`
- **Bibliotecas CDN:** Chart.js 4.4.1, Leaflet.js 1.9.4, Tabler Icons 3.0, Inter font, XLSX.js
- **Deploy:** GitHub Pages via GitHub Actions (push → auto-deploy)

---

## Modelo de Dados (PostgreSQL v4)

```
usuarios       — id, nome, email, senha_hash, papel(admin|consultor), ativo
clientes       — id, empresa, cnpj, segmento, uf, tier, status, health_score, mrr, ...
reunioes       — id, cliente_id→clientes, tipo, data_iso, csat, nps, sentimento, ...
acoes          — id, cliente_id→clientes, descricao, area, status, categoria, log(JSONB), ...
nps            — id, cliente_id→clientes, nota(0-10), respondente, data_iso
timeline       — id, cliente_id→clientes, tipo, titulo, descricao, usuario, historico(JSONB)
onboardings    — id, cliente_id→clientes, etapas(JSONB), progresso
alertas_dismissed — alerta_id (PK), dispensado_em
configuracoes  — chave (PK), valor(JSONB)
audios         — id, cliente_id→clientes, data_base64, duracao
```

**Índices críticos:**
- `idx_acoes_categoria` e `idx_acoes_status_prazo` — para alertas dinâmicos sem N+1
- `idx_clientes_cnpj_unico` — UNIQUE PARTIAL (permite CNPJ nulo em importação Excel)

---

## Módulos do Sistema

| Módulo | Página HTML | Função |
|--------|-------------|--------|
| Dashboard | `page-dashboard` | KPIs, MRR, HS médio, alertas resumo |
| Hoje | `page-hoje` | Reuniões do dia, renovações próximas, pendências |
| Alertas | `page-alertas` | Alertas dinâmicos com dismiss 7 dias |
| Clientes | `page-clientes` | CRUD carteira, busca CNPJ/CEP |
| Cliente 360 | `page-cliente360` | Visão 360° de um cliente (timeline + métricas) |
| Agenda | `page-agenda` | Calendário semanal + mapa Leaflet + resumo |
| Reuniões | `page-reunioes` | Registro de reuniões realizadas + histórico |
| Planos de Ação | `page-planos` | Kanban (Pendente / Em Andamento / Concluído) |
| NPS | `page-nps` | Coleta e análise NPS com gráficos |
| Timeline | `page-timeline` | Histórico auditável por cliente |
| Onboarding | `page-onboarding` | Checklist de implantação com etapas |
| Churn | `page-churn` | Score de probabilidade de cancelamento |
| Engajamento | `page-engajamento` | Frequência e qualidade das interações |
| Relatórios | `page-relatorios` | Export PDF/Excel por período |
| VoC | `page-voc` | Voz do Cliente — sentimentos e tendências |
| Pipeline | `page-pipeline` | Pipeline comercial |
| Importação | `page-importacao` | Import Excel com mapeamento de colunas |
| Dashboard Exec | `page-exec` | Visão executiva impressível |
| Configurações | `page-config` | Config global, usuários, backup |

---

## Navegação SPA (v3)

```javascript
// Troca de página: .page{display:none} → .page.active{display:block}
function nav(el, p) {
  document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  if (p === 'agenda') renderAgenda();
  if (p === 'planos') renderKanban();
  // ... etc
}
```

**Regra:** `renderXxx()` é sempre chamada ao navegar para a página, não no load inicial.

---

## Segurança (v4)

- JWT Bearer token, expira 12h, `JWT_SECRET` obrigatório no .env
- Senhas: `bcrypt` (salt rounds padrão)
- Rate limiting: 20 tentativas / 15min na rota de login
- SQL: exclusivamente queries parametrizadas (`$1`, `$2`, ...) — zero concatenação
- Backend nunca exposto diretamente ao host (apenas na rede Docker interna)
- CNPJ: UNIQUE PARTIAL index (não bloqueia importação em lote)
- Alertas dismissed expiram em 7 dias automaticamente (sem acúmulo infinito)
- KV store limitado a 1MB por valor + validação de chave
