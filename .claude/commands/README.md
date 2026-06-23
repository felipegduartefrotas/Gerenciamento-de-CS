# CS Manager — Skills de Desenvolvimento

Pacote completo de skills para construir e evoluir o CS Manager de ponta a ponta.

---

## Índice de Skills

| Skill | Uso |
|-------|-----|
| [`/arquitetura`](arquitetura.md) | Visão geral do sistema, stack, estrutura de pastas, modelo de dados |
| [`/code-patterns`](code-patterns.md) | Guard rails, padrões de código, anti-patterns, CS_DB API |
| [`/regras-de-negocio`](regras-de-negocio.md) | Health Score, NPS, fluxos, alertas, churn score |
| [`/implementar-feature`](implementar-feature.md) | Checklist + templates para adicionar qualquer feature ao v3 |
| [`/novo-modulo`](novo-modulo.md) | Criar um módulo completo do zero (sidebar, página, CRUD, JS) |
| [`/integracoes`](integracoes.md) | APIs externas: CNPJ, CEP, Nominatim, Leaflet, Chart.js, XLSX |
| [`/deploy`](deploy.md) | GitHub Pages (v3) e Docker Compose (v4) — comandos e troubleshooting |
| [`/migrar-v3-v4`](migrar-v3-v4.md) | Portar feature do localStorage para PostgreSQL + Node.js |
| [`/projeto-prompts`](projeto-prompts.md) | Prompts prontos para briefar o agente em tarefas comuns |
| [`/troubleshooting`](troubleshooting.md) | Problemas conhecidos, causas raiz e soluções aplicadas |

---

## Fluxo de Trabalho Padrão

```
Receber solicitação
    ↓
/arquitetura   → entender contexto
/regras-de-negocio → entender o que a feature deve respeitar
/code-patterns → revisar guard rails antes de codar
    ↓
/implementar-feature  → se feature pequena no v3
/novo-modulo         → se módulo novo no v3
/migrar-v3-v4        → se portar para v4 backend
    ↓
/deploy → commit, push, verificar deploy
    ↓
/troubleshooting → se algo der errado
```

---

## Regras de Ouro

1. **Trabalhar sempre em `index.html`** — nunca criar arquivos HTML novos no v3
2. **Template literals: máximo 3 níveis** — a regra mais importante de todas
3. **Testar o login** após qualquer alteração — indicador rápido de syntax error
4. **Commit atômico** — uma feature por commit, mensagem descritiva
5. **Push imediato** após confirmação — deploy automático via GitHub Actions

---

## Contexto do Projeto

- **Repositório:** `felipegduartefrotas/Gerenciamento-de-CS`
- **Git user:** Felipe
- **Caminho local:** `C:\Users\Delta\FFKD\Gerenciamento-de-CS\`
- **Branch de deploy:** `main`
- **Arquivo de trabalho:** `index.html` (v3 standalone, ~8000+ linhas)
