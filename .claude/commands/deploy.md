# Skill: Deploy e Infraestrutura

Processos de deploy para v3 (GitHub Pages) e v4 (Docker).

---

## V3 Standalone — GitHub Pages

### Fluxo de Deploy

```
Editar index.html → git add → git commit → git push → GitHub Actions → GitHub Pages
```

**Tempo:** ~1-2 minutos após o push.

### Comandos

```bash
cd "C:\Users\Delta\FFKD\Gerenciamento-de-CS"

# Ver estado
git status
git log --oneline -5

# Commitar e publicar
git add index.html
git commit -m "feat: descrição clara da mudança"
git push
```

**Formato de commit message:**
- `feat:` — nova feature
- `fix:` — correção de bug
- `refactor:` — mudança sem impacto funcional
- `style:` — mudança de CSS/visual apenas

### Workflow GitHub Actions

Arquivo: `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: ["main"]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: "pages"
  cancel-in-progress: false
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - uses: actions/deploy-pages@v4
```

### Verificar Deploy

1. Acessar: `https://github.com/felipegduartefrotas/Gerenciamento-de-CS/actions`
2. Verificar se o workflow mais recente está verde
3. URL publicada: GitHub Pages URL (ver README.md do repo)

---

## V4 Full-Stack — Docker Compose

### Pré-requisitos

- Docker Desktop instalado e rodando
- Arquivo `.env` criado a partir de `.env.example`

### Arquivo .env

```env
DB_PASSWORD=senha_forte_aqui
JWT_SECRET=chave_secreta_longa_aqui_min_32_chars
HTTP_PORT=80
CORS_ORIGIN=http://localhost
```

### Comandos Docker

```bash
cd "C:\Users\Delta\FFKD\Gerenciamento-de-CS\csmanager-app-v4-final"

# Primeira vez (cria containers, banco e aplica schema)
docker compose up -d

# Verificar se os 3 serviços estão UP
docker compose ps

# Ver logs de um serviço
docker compose logs -f backend
docker compose logs -f db

# Parar sem perder dados
docker compose down

# Parar E APAGAR banco (CUIDADO!)
docker compose down -v

# Atualizar após mudança no código
docker compose build backend
docker compose up -d backend
```

### Serviços

| Serviço | Porta Interna | Porta Externa |
|---------|---------------|---------------|
| `db` (PostgreSQL 16) | 5432 | não exposta |
| `backend` (Node.js) | 3001 | não exposta |
| `frontend` (Nginx) | 80 | `HTTP_PORT` (default 80) |

**Acesso:** `http://localhost` (ou IP do servidor)

### Persistência

O banco de dados fica no volume Docker `csmanager_db_data`.  
`docker compose down` → dados preservados  
`docker compose down -v` → dados **APAGADOS**

---

## Schema do Banco (PostgreSQL)

```bash
# Aplicar schema manualmente (apenas se necessário)
docker compose exec db psql -U csmanager -d csmanager -f /dev/stdin < db-init/01_schema.sql

# Acessar PostgreSQL interativo
docker compose exec db psql -U csmanager -d csmanager

# Backup do banco
docker compose exec db pg_dump -U csmanager csmanager > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker compose exec -T db psql -U csmanager csmanager < backup_20260623.sql
```

---

## Migração v3 → v4

Para migrar dados do localStorage (v3) para PostgreSQL (v4):

```bash
# 1. Exportar dados do localStorage via browser (Configurações > Exportar Backup)
# 2. Salvar o arquivo JSON exportado como 'backup.json'
# 3. Rodar o script de migração
cd "C:\Users\Delta\FFKD\Gerenciamento-de-CS\csmanager-app-v4-final\scripts-migracao"
npm install
node migrar.js --arquivo backup.json --url http://localhost --email admin@empresa.com --senha SenhaAdmin123
```

---

## Troubleshooting de Deploy

### GitHub Actions falhando

```bash
# Ver último erro nos Actions
# https://github.com/felipegduartefrotas/Gerenciamento-de-CS/actions

# Forçar re-run do deploy sem novo commit
gh workflow run deploy.yml  # requer GitHub CLI
```

### Docker: porta 80 em uso

```yaml
# Alterar porta no .env
HTTP_PORT=8080
# Acessar: http://localhost:8080
```

### Docker: banco não inicia

```bash
docker compose logs db  # ver erro específico
# Mais comum: DB_PASSWORD inválida ou volume corrompido
docker compose down -v  # APAGA dados! Só em dev.
docker compose up -d
```

### Backend: "JWT_SECRET não definido"

```bash
# Verificar se .env existe e tem JWT_SECRET
cat .env | grep JWT_SECRET
# Deve retornar: JWT_SECRET=valor_aqui
```

---

## Credenciais Padrão (v4 — trocar após primeiro deploy)

- **Email:** `felipe@creare.com.br`
- **Senha:** `Creare2026!`
- **Papel:** `admin`

> **IMPORTANTE:** Criar novo usuário admin pela interface e desativar ou alterar a senha padrão.
