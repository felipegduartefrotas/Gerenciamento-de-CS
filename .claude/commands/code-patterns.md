# Skill: Padrões de Código e Guard Rails

Regras técnicas obrigatórias para qualquer alteração no `index.html` (v3 standalone).

---

## REGRA CRÍTICA #1 — Template Literals Aninhados

**O arquivo `index.html` tem dois blocos `<script>` principais:**
- Bloco 1 (`_part1Loaded`, linhas ~2156–5556): código mais antigo, sensível a nesting
- Bloco 2 (`_part2Loaded`, linhas ~5557–6881): código mais recente

**Profundidade máxima de template literal:** 3 níveis dentro de qualquer `<script>`.

### PROIBIDO — Causa parser error silencioso:
```javascript
// NUNCA faça isso (4 níveis de backtick):
el.innerHTML = `
  ${arr.map(item => `
    <div class="${item.active ? `active` : ``}">  // <-- 3º nível DENTRO de ${...}
    </div>
  `)}
`;
```

### PADRÃO SEGURO — Use funções auxiliares:
```javascript
// Extrai o HTML complexo para uma função que retorna string
function _renderBadge(status) {
  return status === 'ativo'
    ? '<span class="badge-green">Ativo</span>'
    : '<span class="badge-red">Inativo</span>';
}

// Usa concatenação de string para variáveis calculadas antes do template
const badge = _renderBadge(item.status);
const itemHtml = `<div>${badge}</div>`;  // Apenas 1 nível
```

### Regra de bolso:
> Se você tiver `${...}` dentro de `` ` ` `` dentro de `${...}` dentro de `` ` ` `` — PARE. Use uma função helper ou variável string.

---

## REGRA CRÍTICA #2 — Variáveis em Áreas de Risco

Em funções que renderizam HTML complexo (Kanban, Agenda, Cliente 360):

```javascript
// USE: var + function declaration (hoisted, sem problema de TDZ)
var _devPend = lastSol && (!lastResp || new Date(lastResp.em) < new Date(lastSol.em));
var devBtn = isReuniao ? '' : ('<div class="k-dev-btn" onclick="...">' + label + '</div>');

// EVITE dentro de blocos de renderização complexos:
const devBtn = `...`;  // Pode criar problemas se estiver em closure complexo
```

---

## REGRA CRÍTICA #3 — Verificação de Saúde do Script

Após qualquer alteração no `index.html`, o app exibe:

```html
<!-- No final do arquivo, verifica se os dois blocos carregaram -->
<script>
  var p1 = typeof _part1Loaded === 'function';
  var p2a = typeof _part2Loaded === 'function';
  // Se p1 ou p2a for false → ERRO no bloco correspondente
</script>
```

**Como testar:** abrir o app e fazer login. Se a tela de login não aparece (ou o login não funciona), há um syntax error no `_part1Loaded` block.

---

## CS_DB — Objeto de Banco de Dados (v3)

```javascript
// Leitura
const acoes = CS_DB.get('acoes') || [];          // Sempre usar || []
const clientes = CS_DB.getClientes();            // Método com filtros opcionais
const reunioes = CS_DB.getAllReunioes();         // Ordenado por data desc

// Escrita
CS_DB.saveAcao(acao);           // Cria ou atualiza por id
CS_DB.saveCliente(cliente);     // Cria ou atualiza por id
CS_DB.saveReuniao(reuniao);     // Cria + recalcula Health Score

// Storage keys (PREFIX = 'creare_cs_')
// acoes → 'creare_cs_acoes'
// clientes → 'creare_cs_clientes'
// reunioes → 'creare_cs_reunioes'
// nps → 'creare_cs_nps'
```

**Nunca escrever diretamente no localStorage** — sempre usar `CS_DB.set(key, data)`.

---

## Padrão de Modal

```javascript
// Abrir
function openM(id) {
  document.getElementById(id).style.display = 'flex';
}
// Fechar
function closeM(id) {
  document.getElementById(id).style.display = 'none';
}

// Estrutura HTML de modal
/*
<div class="modal-ov" id="mNomeModal">
  <div class="modal" style="max-width:520px">
    <div class="modal-ttl">
      <span>Título</span>
      <button class="modal-close" onclick="closeM('mNomeModal')">
        <i class="ti ti-x"></i>
      </button>
    </div>
    <input type="hidden" id="nomeId">
    <!-- campos -->
    <div class="btn-row">
      <button class="btn-ghost" onclick="closeM('mNomeModal')">Cancelar</button>
      <button class="btn-primary" onclick="salvarNome()">Salvar</button>
    </div>
  </div>
</div>
*/
```

---

## Padrão de Toast

```javascript
// Sucesso (padrão)
toast('Registro salvo com sucesso!');

// Erro
toast('Erro ao salvar. Tente novamente.', 'err');

// Ok (confirmação)
toast('Endereço selecionado!', 'ok');
```

---

## Padrão de Página

```html
<!-- Cada página segue este template -->
<div class="page" id="page-nome">
  <div class="ph">
    <h2><i class="ti ti-icone"></i>Título da Página</h2>
    <div style="display:flex;gap:8px">
      <!-- botões de ação do header -->
    </div>
  </div>
  <!-- conteúdo renderizado por renderNome() -->
  <div id="nomeContent"></div>
</div>
```

---

## Padrão de Card Kanban

Cards do Kanban (Plano de Ação) são renderizados em `renderKanban()`. Cada card tem:

```javascript
// Estrutura de uma ação (objeto salvo no CS_DB)
{
  id: 'aco_' + Date.now(),
  clienteId: 'cli_xxx',
  empresa: 'Nome Empresa',
  descricao: 'Texto da ação',
  area: 'CS',
  prioridade: 'Alta' | 'Média' | 'Baixa',
  status: 'Pendente' | 'Em Andamento' | 'Concluído' | 'Cancelada',
  progresso: 0-100,
  responsavel: 'Nome',
  prazo: 'DD/MM/AAAA',
  prazoISO: '2026-06-23T00:00:00.000Z',
  categoria: null | 'reuniao_agendada',
  log: [{texto, em, por}],
  devolutivas: [{area, mensagem, tipo:'solicitacao'|'resposta', em, por}],
  reuniaoParticipantes: [{nome, cargo}],
  modalidade: 'online' | 'presencial',
  lat: Number | undefined,
  lng: Number | undefined,
}
```

---

## Padrão de Renderização com Dados Externos (APIs)

```javascript
// Sempre assíncrono, sempre com try/catch por camada
async function buscarDados() {
  try {
    const r = await fetch(URL);
    if (!r.ok) throw new Error('http_' + r.status);
    const data = await r.json();
    // preencher campos
  } catch (e) {
    // mostrar estado de erro, não quebrar o app
    toast('Falha ao buscar. Preencha manualmente.', 'err');
  }
}
```

**APIs externas em uso:**
- `publica.cnpj.ws/cnpj/{cnpj}` — dados empresariais
- `brasilapi.com.br/api/cnpj/v1/{cnpj}` — fallback CNPJ
- `viacep.com.br/ws/{cep}/json/` — lookup de CEP
- `nominatim.openstreetmap.org/search` — geocoding de endereço
- `unpkg.com/leaflet@1.9.4` — mapa interativo

---

## Padrão de Funções de Renderização

```javascript
// Sempre defensivas — nunca assumir que os elementos existem
function renderAlgo() {
  const el = document.getElementById('algoContent');
  if (!el) return;  // Guard obrigatório

  const dados = CS_DB.get('dados') || [];
  if (!dados.length) {
    el.innerHTML = '<div class="empty-state">...</div>';
    return;
  }

  el.innerHTML = dados.map(d => renderItemCard(d)).join('');
}
```

---

## Guard Rails de CSS

- **Variáveis CSS:** sempre usar `var(--green)`, `var(--red)`, `var(--gray2)`, etc. — nunca cores hard-coded
- **Dark mode:** se um elemento novo for visível, testar com dark mode (`.dark-mode` no body)
- **Mobile:** o layout usa `display:grid` com `grid-template-columns` — sempre testar com largura < 768px
- **Inline styles:** usar apenas para valores dinâmicos (calculados em JS). Layout estático vai para `<style>`

## Variáveis CSS Disponíveis

```css
--green: #1d9e75    --red: #e74c3c      --yellow: #eab308
--blue: #0284c7     --purple: #7c3aed   --white: #ffffff
--black: #111827    --dark: #1a1a2e
--gray1: #374151    --gray2: #6b7280    --gray3: #9ca3af
--gray4: #d1d5db    --gray5: #f3f4f6
```
