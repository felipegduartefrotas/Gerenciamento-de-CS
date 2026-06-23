# Skill: Implementar Feature no v3 Standalone

Use este skill como checklist e template ao adicionar qualquer feature nova ao `index.html`.

---

## Antes de Começar

1. **Ler `/arquitetura`** — confirmar contexto geral do sistema
2. **Ler `/code-patterns`** — revisar guard rails obrigatórios
3. **Ler `/regras-de-negocio`** — confirmar que a feature respeita os fluxos existentes
4. **Localizar os pontos de inserção** usando Grep (nunca assumir linha sem verificar)

```bash
# Localizar elementos existentes antes de editar
grep -n "id=\"nomeElemento\"" index.html
grep -n "function nomeFuncao" index.html
```

---

## Checklist de Implementação

### CSS
- [ ] Adicionar classes novas após `.dark-mode .teams-transcript-box` (linha ~620)
- [ ] Usar variáveis CSS (`var(--green)`) — nunca cores hard-coded
- [ ] Testar se a classe não conflita com existentes (grep pelo nome)
- [ ] Adicionar versão dark mode se o elemento mudar cor de fundo/texto

### HTML
- [ ] IDs únicos — verificar com grep antes de usar
- [ ] Modais seguem estrutura: `.modal-ov` > `.modal` > `.modal-ttl` + campos + `.btn-row`
- [ ] Inputs hidden para estado de formulário (`<input type="hidden" id="...">`)
- [ ] Elementos de estado mútuo (ex: mapa/mensagem vazia) — definir estado padrão no HTML, não depender de JS para primeiro render

### JavaScript
- [ ] Funções no Bloco 1 (`_part1Loaded`): usar `var` + `function declaration`
- [ ] Template literals: máximo 3 níveis — extrair para funções auxiliares se necessário
- [ ] `CS_DB.get('chave') || []` — sempre com fallback
- [ ] Elementos do DOM: sempre verificar existência antes de usar (`if(!el)return`)
- [ ] Funções de render: chamar `updateStatusBar()` após saves importantes
- [ ] Funções assíncronas: sempre envolver em try/catch

---

## Template de Feature Simples (novo campo num modal existente)

```html
<!-- 1. HTML do campo no modal (localizar o modal pelo id e adicionar antes do .btn-row) -->
<div class="fg">
  <label>Nome do Campo</label>
  <input type="text" id="fNovoCampo" placeholder="...">
</div>
```

```javascript
// 2. Salvar o campo (dentro da função existente de salvar)
const novoCampo = document.getElementById('fNovoCampo').value.trim();
// ... adicionar ao objeto sendo salvo:
// novoCampo: novoCampo,

// 3. Carregar o campo ao abrir o modal (dentro da função existente de abrir)
document.getElementById('fNovoCampo').value = objeto.novoCampo || '';
```

---

## Template de Feature com Nova Seção Visual (painel/card)

```html
<!-- No HTML da página correspondente, após o elemento existente -->
<div class="card" style="margin-top:16px">
  <div class="card-ttl" style="margin-bottom:12px">
    <i class="ti ti-icone"></i>Título da Seção
  </div>
  <div id="novaSeccaoContent"></div>
</div>
```

```javascript
// Função de renderização
function renderNovaSeccao() {
  var el = document.getElementById('novaSeccaoContent');
  if (!el) return;

  var dados = CS_DB.get('chave') || [];
  if (!dados.length) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--gray3)">'
      + '<i class="ti ti-icone-vazio" style="font-size:28px;display:block;margin-bottom:8px"></i>'
      + 'Nenhum dado cadastrado'
      + '</div>';
    return;
  }

  el.innerHTML = dados.map(function(d) {
    return '<div style="padding:8px 0;border-bottom:1px solid var(--gray5)">'
      + d.campo
      + '</div>';
  }).join('');
}

// Adicionar à função de navegação (na função nav(), no bloco if(p==='pagina'))
// if(p==='pagina') { renderPagina(); renderNovaSeccao(); }
```

---

## Template de Feature com Nova Página Inteira

```html
<!-- 1. Adicionar item na sidebar (após o último <div class="nav-item">) -->
<div class="nav-item" onclick="nav(this,'nova-pagina')">
  <i class="ti ti-icone"></i>
  <span>Nome da Página</span>
</div>

<!-- 2. Adicionar a página (antes do </div><!-- /content -->) -->
<div class="page" id="page-nova-pagina">
  <div class="ph">
    <h2><i class="ti ti-icone"></i>Nome da Página</h2>
    <div style="display:flex;gap:8px">
      <button class="btn-primary" onclick="abrirModalNovaPagina()">
        <i class="ti ti-plus"></i>Nova Ação
      </button>
    </div>
  </div>
  <div id="novaPaginaContent"></div>
</div>
```

```javascript
// 3. Constantes de página (adicionar no objeto PICONS e PTITLES)
// PICONS: 'nova-pagina': 'ti-icone'
// PTITLES: 'nova-pagina': 'Nome da Página'

// 4. Função de render principal
function renderNovaPagina() {
  var el = document.getElementById('novaPaginaContent');
  if (!el) return;
  // ... implementação
}

// 5. Adicionar ao switch de navegação (dentro de nav())
// if(p==='nova-pagina') renderNovaPagina();
```

---

## Após Implementar

1. **Testar login** — se o login não carrega, há syntax error no bloco 1
2. **Testar a feature** — golden path + edge cases
3. **Testar em dark mode** — clicar no toggle de tema
4. **Commit e push:**

```bash
cd "C:\Users\Delta\FFKD\Gerenciamento-de-CS"
git add index.html
git commit -m "feat: descrição da feature adicionada"
git push
```

5. **Aguardar deploy** (~1-2 min) — GitHub Actions auto-deploy
6. **Verificar no GitHub Pages** — URL da preview no README
