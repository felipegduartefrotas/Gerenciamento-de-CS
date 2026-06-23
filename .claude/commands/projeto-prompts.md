# Skill: Prompts de Projeto para Implementação

Prompts prontos para briefar qualquer agente/harness de desenvolvimento sobre tarefas específicas do CS Manager. Copie, adapte e use.

---

## Como Usar Este Skill

1. Identificar qual tipo de tarefa você precisa realizar
2. Copiar o prompt template correspondente
3. Preencher os `[PLACEHOLDERS]`
4. Complementar com contexto específico da sessão
5. Enviar ao Claude Code (ou outro agente)

---

## PROMPT 1: Nova Feature no v3 Standalone

```
Você é o arquiteto do CS Manager, plataforma de Customer Success da Creare Sistemas.

CONTEXTO DO PROJETO:
- Arquivo principal: C:\Users\Delta\FFKD\Gerenciamento-de-CS\index.html
- Arquivo único de ~8000+ linhas (HTML + CSS + JS tudo junto)
- Banco de dados: localStorage via objeto CS_DB
- Deploy: GitHub Pages via push na branch main

GUARD RAILS CRÍTICOS:
1. Template literals aninhados: MÁXIMO 3 níveis. Para complexidade maior, usar funções helper que retornam string pura com concatenação.
2. Sempre verificar existência de elemento antes de usar: if(!el)return
3. CS_DB.get('chave')||[] — sempre com fallback
4. Testar se o login continua funcionando após qualquer alteração
5. Usar var+function em vez de const+arrow em funções de renderização complexas

FEATURE A IMPLEMENTAR:
[DESCREVER A FEATURE AQUI]

ARQUIVOS A LER ANTES:
- Ler as linhas [LINHA_INICIO]-[LINHA_FIM] para entender o contexto atual
- Grep por "[TERMO]" para localizar o ponto de inserção

ENTREGÁVEL ESPERADO:
- Editar index.html com a implementação completa
- Fazer commit: "feat: [descrição]"
- Fazer push (o deploy é automático)
```

---

## PROMPT 2: Correção de Bug Crítico

```
Você é o arquiteto do CS Manager. Um bug crítico foi reportado.

SISTEMA:
- index.html (v3 standalone, ~8000 linhas)
- URL: GitHub Pages (deploy automático no push)

SINTOMA DO BUG:
[DESCREVER O QUE O USUÁRIO VÊ]

COMPORTAMENTO ESPERADO:
[O QUE DEVERIA ACONTECER]

HISTÓRICO DE COMMITS (git log --oneline -10):
[COLAR AQUI]

DIAGNÓSTICO INICIAL:
- Se login não carrega: syntax error no bloco _part1Loaded (linhas 2156-5556)
- Se função não existe: procurar se foi acidentalmente removida
- Verificar no console: typeof _part1Loaded e typeof _part2Loaded

REGRA DE FALLBACK:
Se o bug foi introduzido no último commit, reverta primeiro:
git revert HEAD --no-edit && git push
Depois implemente a correção corretamente.

ENTREGÁVEL:
- Diagnóstico: qual a causa raiz
- Fix mínimo necessário (sem alterar mais do que o necessário)
- Commit com prefixo "fix:" e push
```

---

## PROMPT 3: Novo Módulo Completo

```
Você é o arquiteto do CS Manager (plataforma de CS da Creare Sistemas).

SISTEMA: index.html (v3 standalone, localStorage, ~8000 linhas)

NOVO MÓDULO A CRIAR: [NOME DO MÓDULO]
Objetivo: [O QUE FAZ]
Localização na sidebar: [DEPOIS DE QUAL ITEM]
Ícone Tabler: [ti-nome-icone]

ESTRUTURA ESPERADA DO MÓDULO:
1. Item na sidebar (div.nav-item onclick="nav(this,'[id-pagina]')")
2. Constantes PICONS['[id]'] e PTITLES['[id]']
3. div.page#page-[id] com .ph e botão de ação principal
4. Div container #[id]Content para renderização dinâmica
5. Função render[Nome]() que popula o container
6. Modal(is) para CRUD se necessário
7. Funções de save/load via CS_DB

DADOS QUE O MÓDULO GERENCIA:
- Chave localStorage: [nome]
- Campos do objeto: [campo1: tipo, campo2: tipo, ...]

REGRAS DE NEGÓCIO:
[LISTAR REGRAS ESPECÍFICAS DO MÓDULO]

GUARD RAILS:
- Template literals: máximo 3 níveis
- Funções helper para HTML complexo
- Sempre chamar updateStatusBar() após saves
- Estado vazio (sem dados) sempre tratado visualmente

APÓS IMPLEMENTAR:
git add index.html && git commit -m "feat: adiciona módulo [nome]" && git push
```

---

## PROMPT 4: Integração com API Externa

```
Você vai adicionar uma integração com API externa ao CS Manager.

SISTEMA: index.html (v3 standalone)

API A INTEGRAR:
- URL: [URL_DA_API]
- Método: [GET/POST]
- Autenticação: [sem autenticação / API key: X / OAuth]
- Rate limit: [X req/segundo]

CAMPOS QUE SERÃO PREENCHIDOS AUTOMATICAMENTE:
- Trigger: [quando o usuário faz X]
- Campo 1: elemento #[id] ← vem de response.[campo]
- Campo 2: elemento #[id] ← vem de response.[campo]
- ...

ESTRUTURA DA RESPOSTA DA API:
[COLAR EXEMPLO DE JSON]

FALLBACK SE API FALHAR:
- Mostrar toast com "Erro ao buscar. Preencha manualmente."
- Não bloquear o formulário

PADRÃO DE IMPLEMENTAÇÃO:
async function buscar[Entidade]() {
  // try primário
  try {
    const r = await fetch(URL);
    if (!r.ok) throw new Error();
    const d = await r.json();
    // preencher campos
  } catch(e) {
    // fallback ou mensagem de erro
  }
}

ENTREGÁVEL:
- Função de busca implementada
- Trigger conectado (oninput, onchange ou botão)
- Loading state (sd('loadId', true/false))
- Toast de sucesso/erro
- Commit + push
```

---

## PROMPT 5: Migração de Feature para v4 Backend

```
Você vai migrar a feature [NOME] do v3 (localStorage) para o v4 (PostgreSQL + Node.js).

ARQUIVOS DO V4:
- Backend: C:\Users\Delta\FFKD\Gerenciamento-de-CS\csmanager-app-v4-final\backend\
- Frontend: C:\Users\Delta\FFKD\Gerenciamento-de-CS\csmanager-app-v4-final\frontend\
- Schema: db-init/01_schema.sql

FEATURE NO V3:
- Dados salvos em CS_DB.get('[chave]')
- Campos: [listar campos do objeto]
- Funções: [salvar(), abrir(), render()]

MUDANÇAS NECESSÁRIAS:
1. Schema PostgreSQL: [adicionar colunas ou nova tabela]
2. Rota backend: [nova rota ou atualizar rota existente]
3. api.js frontend: [atualizar função correspondente]

REGRAS SQL:
- Sempre queries parametrizadas ($1, $2, ...)
- Campos JSONB: sempre JSON.stringify() ao salvar
- Campos JSONB: pg driver já parseia ao ler (não precisa JSON.parse())
- Nunca concatenar strings em queries SQL

ENTREGÁVEL:
1. Alteração em db-init/01_schema.sql (com IF NOT EXISTS / ALTER TABLE)
2. Rota backend nova ou atualizada
3. api.js atualizado
4. Rebuild: docker compose build backend && docker compose up -d backend
```

---

## PROMPT 6: Investigar e Corrigir Bug de Dados

```
Você vai diagnosticar um problema de dados no CS Manager.

SINTOMA:
[DESCREVER O QUE O USUÁRIO VÊ]
Exemplo: "Painel X está vazio mesmo com dados cadastrados"

CONTEXTO DO SISTEMA (v3 standalone, localStorage):
- CS_DB.get('acoes')||[] — para buscar ações
- CS_DB.get('clientes')||[] — para buscar clientes
- Funções de render são chamadas em nav() ao navegar para a página

HIPÓTESES A INVESTIGAR (em ordem):
1. O elemento #contentId existe quando a função roda?
2. CS_DB.get() está retornando dados? (typeof + length)
3. O filtro aplicado está correto? (testar sem filtros primeiro)
4. Há exceção sendo jogada que cancela a execução?

COMO ADICIONAR DIAGNÓSTICO:
- Adicionar try/catch ao redor das chamadas de render
- Usar console.error('nomeFuncao:', e) para capturar
- Verificar no console do browser

DADOS DE DEBUG ÚTEIS:
CS_DB.get('acoes').length  // quantidade de ações
CS_DB.get('acoes').filter(a => a.categoria === 'reuniao_agendada').length  // ações agendadas
document.getElementById('agendaResumoList')  // elemento existe?

ENTREGÁVEL:
- Diagnóstico: causa raiz identificada
- Correção mínima e robusta
- Commit "fix: [descrição]" + push
```

---

## PROMPT 7: Adicionar Campo ao Cadastro de Cliente

```
Você vai adicionar o campo [NOME DO CAMPO] ao cadastro de cliente no CS Manager.

SISTEMA: index.html (v3 standalone)

CAMPO A ADICIONAR:
- Nome: [nome]
- Tipo: [texto | número | data | select | textarea]
- Obrigatório: [sim/não]
- Localização no formulário: [após o campo X / na seção Y]
- ID do input HTML: f[NomePascalCase]
- Opções (se select): [op1, op2, op3]

ONDE O CAMPO APARECE:
- [ ] Modal de criação de cliente
- [ ] Modal de edição de cliente
- [ ] Card de cliente 360
- [ ] Tabela da lista de clientes
- [ ] Exportação Excel/relatório

PERSISTÊNCIA:
O campo deve ser salvo em CS_DB.get('clientes') no objeto do cliente.

PASSOS:
1. Adicionar campo HTML no modal de cadastro (id="f[Nome]")
2. Incluir no objeto ao salvar em salvarCliente()
3. Carregar no abrirEditarCliente() para edição
4. Exibir no card da lista/360 se relevante
5. Incluir no completude do cadastro (barra de progresso) se obrigatório

ENTREGÁVEL:
- Implementação completa
- Commit + push
```
