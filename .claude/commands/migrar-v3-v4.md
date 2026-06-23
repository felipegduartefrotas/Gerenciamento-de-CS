# Skill: Migrar Feature de v3 para v4 Full-Stack

Use este skill quando precisar portar uma feature do `index.html` (v3/localStorage) para o backend Node.js + PostgreSQL (v4).

---

## Quando Usar

- Feature foi implementada e validada no v3
- Agora precisa ser disponibilizada na versão de produção (v4)
- A feature envolve persistência de dados (não é só visual)

---

## Checklist de Migração

### 1. Analisar a feature no v3

```bash
# Identificar todos os campos salvos no objeto
grep -n "categoria.*reuniao_agendada" index.html
grep -n "devolutivas" index.html

# Identificar funções de save/read
grep -n "CS_DB.save\|CS_DB.get\|CS_DB.set" index.html
```

**Mapear:**
- Quais campos são salvos? (`a.campo1`, `a.campo2`, ...)
- Em qual chave do localStorage? (`acoes`, `clientes`, `reunioes`, ...)
- Qual tabela do PostgreSQL corresponde? (ver `/arquitetura`)

### 2. Verificar/Atualizar o Schema

```sql
-- Abrir 01_schema.sql e verificar se a tabela tem os campos necessários
-- Exemplo: adicionar campo novo
ALTER TABLE acoes ADD COLUMN IF NOT EXISTS reuniao_modalidade TEXT;
ALTER TABLE acoes ADD COLUMN IF NOT EXISTS reuniao_endereco TEXT;
ALTER TABLE acoes ADD COLUMN IF NOT EXISTS reuniao_lat NUMERIC(10,7);
ALTER TABLE acoes ADD COLUMN IF NOT EXISTS reuniao_lng NUMERIC(10,7);
ALTER TABLE acoes ADD COLUMN IF NOT EXISTS reuniao_participantes JSONB DEFAULT '[]';
ALTER TABLE acoes ADD COLUMN IF NOT EXISTS devolutivas JSONB DEFAULT '[]';
```

### 3. Atualizar a Rota do Backend

```javascript
// Em backend/src/routes/acoes.js — POST (criar)
// Adicionar campos novos nos parâmetros
const { ..., reuniao_modalidade, reuniao_endereco, reuniao_lat, reuniao_lng,
        reuniao_participantes, devolutivas } = req.body;

// Na query INSERT — adicionar colunas e valores
const { rows } = await pool.query(
  `INSERT INTO acoes (..., reuniao_modalidade, reuniao_endereco, reuniao_lat, reuniao_lng,
   reuniao_participantes, devolutivas)
   VALUES (..., $18, $19, $20, $21, $22, $23) RETURNING *`,
  [..., reuniao_modalidade || null, reuniao_endereco || null,
   reuniao_lat || null, reuniao_lng || null,
   JSON.stringify(reuniao_participantes || []),
   JSON.stringify(devolutivas || [])]
);
```

### 4. Atualizar api.js (Frontend v4)

```javascript
// Em frontend/api.js — função saveAcao()
async saveAcao(acao) {
  const body = {
    ...acao,
    // garantir que campos JSONB são enviados como JSON
    reuniao_participantes: acao.reuniaoParticipantes || [],
    devolutivas: acao.devolutivas || [],
  };
  // ... rest of the save logic
}
```

### 5. Normalizar nomes de campo (camelCase → snake_case)

O v3 usa camelCase (JavaScript convention), o v4 usa snake_case (PostgreSQL convention).

| v3 (camelCase) | v4 (snake_case) |
|----------------|-----------------|
| `clienteId` | `cliente_id` |
| `reuniaoTipo` | `reuniao_tipo` |
| `reuniaoData` | `reuniao_data` |
| `prazoISO` | `prazo_iso` |
| `healthScore` | `health_score` |
| `devolutivas` | `devolutivas` (JSONB — mesmo nome) |

**Em api.js, fazer a tradução:**
```javascript
// Na função que converte resposta do backend para o frontend
function _normalize(row) {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    empresa: row.empresa,
    reuniaoTipo: row.reuniao_tipo,
    reuniaoData: row.reuniao_data,
    // ...
  };
}
```

---

## Template: Nova Rota de API (CRUD Completo)

```javascript
// backend/src/routes/nova_entidade.js
const express = require('express');
const pool = require('../db/pool');
const { autenticar } = require('../middleware/auth');
const router = express.Router();
router.use(autenticar);

// GET /api/nova-entidade
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM nova_entidade ORDER BY criado_em DESC'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao buscar.' });
  }
});

// POST /api/nova-entidade
router.post('/', async (req, res) => {
  const { campo1, campo2 } = req.body;
  if (!campo1) return res.status(400).json({ erro: 'campo1 é obrigatório.' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO nova_entidade (campo1, campo2, criado_por) VALUES ($1, $2, $3) RETURNING *',
      [campo1, campo2 || null, req.usuario.nome]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao criar.' });
  }
});

// PUT /api/nova-entidade/:id
router.put('/:id', async (req, res) => {
  const { campo1, campo2 } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE nova_entidade SET campo1=$1, campo2=$2 WHERE id=$3 RETURNING *',
      [campo1, campo2, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Não encontrado.' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao atualizar.' });
  }
});

// DELETE /api/nova-entidade/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM nova_entidade WHERE id=$1 RETURNING id', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Não encontrado.' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao deletar.' });
  }
});

module.exports = router;
```

### Registrar a rota no server.js

```javascript
// Em backend/src/server.js
const novaEntidadeRoutes = require('./routes/nova_entidade');
app.use('/api/nova-entidade', novaEntidadeRoutes);
```

---

## Campos JSONB — Cuidados

Campos JSONB no PostgreSQL (como `log`, `devolutivas`, `reuniao_participantes`):

```javascript
// Ao ler do banco — pode vir como objeto JS já parsed (pg driver parseia JSON automático)
const log = row.log || [];  // nunca precisa de JSON.parse()

// Ao salvar no banco — sempre serializar
JSON.stringify(minhaArray)  // nunca passar o array diretamente

// Utilitário já existente:
const { comoArray } = require('../db/jsonbUtil');
const log = comoArray(row.log);  // garante sempre array, mesmo se string ou null
```

---

## Teste Após Migração

```bash
# 1. Rebuild do backend
cd csmanager-app-v4-final
docker compose build backend
docker compose up -d backend

# 2. Verificar logs
docker compose logs -f backend

# 3. Testar a API diretamente
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"felipe@creare.com.br","senha":"Creare2026!"}'
# Guardar o token retornado

curl http://localhost/api/acoes \
  -H "Authorization: Bearer TOKEN_AQUI"
```
