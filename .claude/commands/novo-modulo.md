# Skill: Criar Novo Módulo

Checklist e templates para criar um módulo completo no CS Manager (v3 standalone).

---

## O que é um Módulo

Um módulo é uma página completa do sistema com:
- Item na sidebar (nav)
- Página (`div.page`) com header (`div.ph`)
- Função de renderização principal
- Modais de CRUD (se necessário)
- Lógica de save/load via CS_DB

---

## Passo 1: Definir o Módulo

Responder antes de começar:

| Pergunta | Exemplo |
|----------|---------|
| ID da página | `voc` |
| Título exibido | `Voz do Cliente` |
| Ícone Tabler | `ti-message-2` |
| Onde na sidebar | Após `engajamento` |
| Chave no CS_DB | `voc` |
| Campos do objeto | `{id, clienteId, empresa, categoria, texto, sentimento, criadoEm}` |

---

## Passo 2: Adicionar à Sidebar

Localizar a posição correta na sidebar e inserir:

```html
<!-- Após o item anterior -->
<div class="nav-item" onclick="nav(this,'voc')">
  <i class="ti ti-message-2"></i>
  <span>Voz do Cliente</span>
</div>
```

---

## Passo 3: Adicionar Constantes de Página

Localizar `PICONS` e `PTITLES` (buscar por `const PICONS`) e adicionar:

```javascript
// Em PICONS:
'voc': 'ti-message-2',

// Em PTITLES:
'voc': 'Voz do Cliente',
```

---

## Passo 4: Adicionar a Página HTML

Localizar `<!-- CONTEÚDO DAS PÁGINAS -->` e adicionar antes do `</div><!-- /content -->`:

```html
<!-- VOZ DO CLIENTE -->
<div class="page" id="page-voc">
  <div class="ph">
    <h2><i class="ti ti-message-2"></i>Voz do Cliente</h2>
    <div style="display:flex;gap:8px">
      <button class="btn-primary" onclick="openM('mNovoVoC')">
        <i class="ti ti-plus"></i>Registrar Feedback
      </button>
    </div>
  </div>
  <!-- Filtros (opcional) -->
  <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
    <select id="vocFiltroCliente" onchange="renderVoC()"
      style="...">
      <option value="">Todos os clientes</option>
    </select>
  </div>
  <!-- Conteúdo dinâmico -->
  <div id="vocContent"></div>
</div>
```

---

## Passo 5: Adicionar Modal de Criação/Edição

```html
<!-- MODAL: Novo/Editar VoC -->
<div class="modal-ov" id="mNovoVoC">
  <div class="modal" style="max-width:500px">
    <div class="modal-ttl">
      <span id="mVoCTtl">Registrar Feedback</span>
      <button class="modal-close" onclick="closeM('mNovoVoC')">
        <i class="ti ti-x"></i>
      </button>
    </div>
    <input type="hidden" id="vocId">
    <div class="fg">
      <label>Cliente <span class="req">*</span></label>
      <select id="vocCliente">
        <option value="">Selecione...</option>
      </select>
    </div>
    <div class="fg">
      <label>Categoria</label>
      <select id="vocCategoria">
        <option>Produto</option>
        <option>Suporte</option>
        <option>Comercial</option>
        <option>Onboarding</option>
        <option>Outro</option>
      </select>
    </div>
    <div class="fg">
      <label>Sentimento</label>
      <select id="vocSentimento">
        <option>Positivo</option>
        <option>Neutro</option>
        <option>Negativo</option>
      </select>
    </div>
    <div class="fg">
      <label>Feedback <span class="req">*</span></label>
      <textarea id="vocTexto" rows="4" placeholder="Descreva o feedback do cliente..."></textarea>
    </div>
    <div class="btn-row">
      <button class="btn-ghost" onclick="closeM('mNovoVoC')">Cancelar</button>
      <button class="btn-primary" onclick="salvarVoC()">Salvar</button>
    </div>
  </div>
</div>
```

---

## Passo 6: Adicionar Funções JavaScript

Localizar o final das funções do módulo anterior e adicionar:

```javascript
// ────── VOZ DO CLIENTE ──────
function renderVoC() {
  var el = document.getElementById('vocContent');
  if (!el) return;

  var dados = CS_DB.get('voc') || [];
  var filtroCliente = document.getElementById('vocFiltroCliente')?.value || '';

  if (filtroCliente) {
    dados = dados.filter(function(v) { return v.clienteId === filtroCliente; });
  }

  if (!dados.length) {
    el.innerHTML = '<div style="text-align:center;padding:48px 0;color:var(--gray3)">'
      + '<i class="ti ti-message-2-off" style="font-size:40px;display:block;margin-bottom:10px"></i>'
      + '<div style="font-size:13px">Nenhum feedback registrado</div>'
      + '<div style="font-size:11.5px;margin-top:4px">Clique em <b>Registrar Feedback</b> para começar</div>'
      + '</div>';
    return;
  }

  // Ordenar por data mais recente
  dados = dados.slice().sort(function(a, b) {
    return new Date(b.criadoEm) - new Date(a.criadoEm);
  });

  el.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px">'
    + dados.map(function(v) {
        var sentClr = v.sentimento === 'Positivo' ? 'var(--green)' : v.sentimento === 'Negativo' ? 'var(--red)' : 'var(--yellow)';
        var sentIcon = v.sentimento === 'Positivo' ? 'ti-mood-smile' : v.sentimento === 'Negativo' ? 'ti-mood-sad' : 'ti-mood-neutral';
        return '<div class="card" style="margin:0;padding:14px 16px">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
            + '<div>'
              + '<div style="font-weight:600;font-size:13px">' + v.empresa + '</div>'
              + '<div style="font-size:11px;color:var(--gray2);margin-top:2px">' + v.categoria + ' · ' + _formatarDataCurta(v.criadoEm) + '</div>'
            + '</div>'
            + '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:' + sentClr + '">'
              + '<i class="ti ' + sentIcon + '" style="font-size:13px"></i>' + v.sentimento
            + '</span>'
          + '</div>'
          + '<div style="font-size:12.5px;color:var(--gray1);line-height:1.6">' + v.texto + '</div>'
          + '<div style="display:flex;gap:8px;margin-top:10px">'
            + '<button class="btn-ghost" style="font-size:11.5px;padding:4px 10px" onclick="abrirEditarVoC(\'' + v.id + '\')">'
              + '<i class="ti ti-edit" style="font-size:12px"></i>Editar</button>'
            + '<button class="btn-ghost" style="font-size:11.5px;padding:4px 10px;color:var(--red);border-color:var(--red)" onclick="deletarVoC(\'' + v.id + '\')">'
              + '<i class="ti ti-trash" style="font-size:12px"></i>Excluir</button>'
          + '</div>'
        + '</div>';
      }).join('')
    + '</div>';
}

function abrirNovoVoC() {
  document.getElementById('vocId').value = '';
  document.getElementById('mVoCTtl').textContent = 'Registrar Feedback';
  document.getElementById('vocCliente').value = '';
  document.getElementById('vocCategoria').value = 'Produto';
  document.getElementById('vocSentimento').value = 'Neutro';
  document.getElementById('vocTexto').value = '';
  _populateVoCClienteSelect();
  openM('mNovoVoC');
}

function abrirEditarVoC(id) {
  var vocArr = CS_DB.get('voc') || [];
  var v = vocArr.find(function(x) { return x.id === id; });
  if (!v) return;
  document.getElementById('vocId').value = v.id;
  document.getElementById('mVoCTtl').textContent = 'Editar Feedback';
  document.getElementById('vocCliente').value = v.clienteId;
  document.getElementById('vocCategoria').value = v.categoria;
  document.getElementById('vocSentimento').value = v.sentimento;
  document.getElementById('vocTexto').value = v.texto;
  _populateVoCClienteSelect();
  openM('mNovoVoC');
}

function salvarVoC() {
  var clienteId = document.getElementById('vocCliente').value;
  var texto = document.getElementById('vocTexto').value.trim();
  if (!clienteId) { toast('Selecione um cliente.', 'err'); return; }
  if (!texto) { toast('Informe o feedback.', 'err'); return; }

  var cli = CS_DB.getClienteById(clienteId);
  var vocArr = CS_DB.get('voc') || [];
  var idExistente = document.getElementById('vocId').value;

  var obj = {
    id: idExistente || 'voc_' + Date.now(),
    clienteId: clienteId,
    empresa: cli ? cli.empresa : '',
    categoria: document.getElementById('vocCategoria').value,
    sentimento: document.getElementById('vocSentimento').value,
    texto: texto,
    criadoEm: idExistente ? (vocArr.find(function(v) { return v.id === idExistente; }) || {}).criadoEm || new Date().toISOString() : new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };

  if (idExistente) {
    var idx = vocArr.findIndex(function(v) { return v.id === idExistente; });
    if (idx >= 0) vocArr[idx] = obj; else vocArr.push(obj);
  } else {
    vocArr.push(obj);
  }

  CS_DB.set('voc', vocArr);
  closeM('mNovoVoC');
  toast(idExistente ? 'Feedback atualizado!' : 'Feedback registrado!');
  renderVoC();
  updateStatusBar();
}

function deletarVoC(id) {
  if (!confirm('Excluir este feedback?')) return;
  var vocArr = (CS_DB.get('voc') || []).filter(function(v) { return v.id !== id; });
  CS_DB.set('voc', vocArr);
  renderVoC();
  toast('Feedback excluído.');
}

function _populateVoCClienteSelect() {
  var sel = document.getElementById('vocCliente');
  if (!sel) return;
  var clientes = CS_DB.getClientes().filter(function(c) { return c.status !== 'Cancelado'; });
  var currentVal = sel.value;
  sel.innerHTML = '<option value="">Selecione o cliente...</option>'
    + clientes.map(function(c) {
        return '<option value="' + c.id + '"' + (c.id === currentVal ? ' selected' : '') + '>' + c.empresa + '</option>';
      }).join('');
}
```

---

## Passo 7: Conectar à Navegação

Localizar a função `nav()` e adicionar o if para o módulo:

```javascript
if (p === 'voc') renderVoC();
```

---

## Passo 8: Testar

1. Recarregar o app
2. Verificar `typeof _part1Loaded === 'function'` no console
3. Navegar para o módulo pela sidebar
4. Criar um registro
5. Editar o registro
6. Deletar o registro
7. Testar em dark mode

## Passo 9: Commit e Deploy

```bash
cd "C:\Users\Delta\FFKD\Gerenciamento-de-CS"
git add index.html
git commit -m "feat: adiciona módulo Voz do Cliente (VoC)"
git push
```
