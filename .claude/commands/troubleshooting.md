# Skill: Troubleshooting — Problemas Conhecidos e Soluções

Catálogo de problemas já encontrados e resolvidos. Consultar **antes** de debugar qualquer issue.

---

## P1 — Login não carrega / Tela em branco

**Sintoma:** App abre mas a tela de login não aparece. Console mostra SyntaxError ou nada.

**Causa raiz:** Template literal aninhado em profundidade > 3 dentro do bloco `_part1Loaded` (linhas 2156–5556 do `index.html`).

**Diagnóstico:**
```javascript
// Verificar no console do browser:
typeof _part1Loaded  // deve ser 'function'
typeof _part2Loaded  // deve ser 'function'
// Se undefined → o bloco correspondente tem syntax error
```

**Solução:**
1. Usar `git log --oneline -10` para identificar o commit que quebrou
2. `git diff HEAD~1 HEAD -- index.html` para ver o que mudou
3. No trecho alterado, extrair template literals aninhados para funções auxiliares:

```javascript
// ANTES (quebrado):
el.innerHTML = `${items.map(i => `<span class="${i.active ? `on` : `off`}">`)}`;

// DEPOIS (correto):
function _cls(i){ return i.active ? 'on' : 'off'; }
el.innerHTML = items.map(i => '<span class="' + _cls(i) + '">').join('');
```

**Fallback se não conseguir identificar:**
```bash
git revert HEAD --no-edit  # Reverte o último commit
git push
```

---

## P2 — Mapa Leaflet não aparece / Caixa cinza

**Sintoma:** Painel do mapa na Agenda mostra um retângulo cinza sem mapa ou ícone de estado vazio.

**Causa raiz (histórica):** `renderAgendaMapa()` jogava erro antes de executar a lógica de display, impedindo que `agendaMapEmpty` fosse exibido. O erro subsequente cancelava `renderAgendaResumo()`.

**Causa secundária:** Leaflet (`L`) não carregado do CDN (falha de rede ou CORS).

**Solução aplicada:**
- `agendaMapDiv` começa com `display:none` por padrão no HTML
- `agendaMapEmpty` começa com `display:flex` (estado vazio visível por padrão)
- Ambas as funções são chamadas em try/catch independentes em `renderAgenda()`
- Guard `typeof L !== 'undefined'` antes de qualquer uso do Leaflet

**Diagnóstico:**
```javascript
// No console:
typeof L  // deve ser 'object' se Leaflet carregou
document.getElementById('agendaMapDiv').style.display  // deve ser 'none' se sem reuniões presenciais c/ coords
document.getElementById('agendaMapEmpty').style.display  // deve ser 'flex'
```

---

## P3 — Painel "Próximas Reuniões" vazio mesmo com reuniões cadastradas

**Sintoma:** Reuniões aparecem no calendário semanal mas a seção "Próximas Reuniões Agendadas" fica em branco sem nenhuma mensagem.

**Causa raiz:** Exceção em `renderAgendaMapa()` cancelava a execução de `renderAgendaResumo()` (chamadas sequenciais sem try/catch).

**Solução aplicada (commit 98786be):**
```javascript
// Em renderAgenda(), wrap em try/catch independentes:
try { renderAgendaMapa(); } catch(e) { console.error('renderAgendaMapa:', e); }
try { renderAgendaResumo(); } catch(e) { console.error('renderAgendaResumo:', e); }
```

---

## P4 — Busca de CNPJ não preenche campos de endereço

**Sintoma:** Ao buscar CNPJ, Razão Social e Cidade/UF são preenchidos mas Nome Fantasia, Natureza Jurídica, Endereço completo e Porte ficam vazios.

**Causa raiz:** Mapeamento errado dos campos da API cnpj.ws:
- `nome_fantasia` está em `j.estabelecimento.nome_fantasia`, não em `j.nome_fantasia` (raiz)
- `tipo_logradouro` não era concatenado ao `logradouro` (ex: faltava "Avenida " antes de "Graça Aranha")
- `atividade_principal` pode ser objeto OU array — não tratava os dois casos
- Campo `fPorte` (select) não era preenchido pela busca

**Solução aplicada (commit c17961c):**
```javascript
// Correções:
fantasia: est.nome_fantasia || j.nome_fantasia || '',  // check em est primeiro
logradouro: (est.tipo_logradouro ? est.tipo_logradouro + ' ' : '') + (est.logradouro || ''),
const ap = Array.isArray(est.atividade_principal) ? est.atividade_principal[0] : est.atividade_principal;
// + preenchimento do select fPorte com normalização de string
// + fallback ViaCEP se logradouro vier vazio
```

---

## P5 — Commit com erro de merge / arquivo corrompido

**Sintoma:** Após `git pull` ou merge, o `index.html` tem marcadores `<<<<<<< HEAD`.

**Solução:**
```bash
git checkout HEAD -- index.html  # descarta a versão com conflito
# OU
git mergetool  # para resolver manualmente
```

**Prevenção:** `git pull --rebase` ao invés de `git pull` (merge).

---

## P6 — GitHub Pages não atualiza após push

**Sintoma:** Push foi feito, mas a URL do GitHub Pages ainda mostra a versão antiga.

**Diagnóstico:**
1. Verificar se o workflow rodou: `https://github.com/felipegduartefrotas/Gerenciamento-de-CS/actions`
2. Se o workflow falhou, ver o log de erro

**Causas comuns:**
- Branch `main` não é o branch padrão de deploy (verificar em Settings > Pages)
- Arquivo `.github/workflows/deploy.yml` com problema de sintaxe
- GitHub Pages desabilitado (Settings > Pages > Source)

**Workflow correto** (`.github/workflows/deploy.yml`):
```yaml
on:
  push:
    branches: ["main"]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    environment:
      name: github-pages
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - uses: actions/deploy-pages@v4
```

---

## P7 — Dados sumindo do localStorage

**Sintoma:** Dados cadastrados somem após recarregar a página.

**Causa raiz A:** `CS_DB.init()` com novo VERSION sobrescreve dados existentes com seed.

**Causa raiz B:** Modo anônimo/privado do browser limpa localStorage ao fechar.

**Causa raiz C:** `localStorage.setItem` retornou false (sem espaço) e o erro foi silenciado.

**Diagnóstico:**
```javascript
// No console:
localStorage.getItem('creare_cs_clientes')  // deve retornar JSON array
JSON.parse(localStorage.getItem('creare_cs_clientes')).length  // quantidade de clientes
```

---

## P8 — Leaflet map "already initialized" error

**Sintoma:** Console mostra "Map container is already initialized" ao navegar para Agenda.

**Causa raiz:** `L.map('agendaMapDiv')` chamado duas vezes no mesmo container sem destruir a instância anterior.

**Solução aplicada:**
```javascript
// window._agdMap guarda a instância
if (!window._agdMap) {
  window._agdMap = L.map('agendaMapDiv', { scrollWheelZoom: false });
} else {
  // Apenas limpa os marcadores, não reinicializa
  window._agdMap.eachLayer(function(l) {
    if (l instanceof L.Marker) window._agdMap.removeLayer(l);
  });
}
// Ao destruir (quando não há reuniões presenciais):
if (window._agdMap) {
  try { window._agdMap.remove(); } catch(e) {}
  window._agdMap = null;
}
```

---

## P9 — Dark mode quebrando visibilidade de elementos novos

**Sintoma:** Novo elemento fica invisível ou com contraste ruim no dark mode.

**Causa:** CSS do dark mode (`.dark-mode .elemento`) não foi adicionado.

**Onde adicionar:**
```css
/* Após a seção .dark-mode existente, adicionar: */
.dark-mode .nova-classe { background: var(--dark); color: var(--gray4); }
.dark-mode .nova-classe-card { border-color: rgba(255,255,255,.08); }
```

**Variáveis que mudam no dark mode:**
- `--white` → escuro | `--gray5` → escuro | `--black` → claro

---

## P10 — Autocomplete de endereço não aparece

**Sintoma:** Ao digitar endereço no modal de reunião, dropdown não aparece.

**Causa raiz A:** Input com menos de 4 caracteres (debounce tem mínimo de 4).  
**Causa raiz B:** `agrEnderecoDrop` não existe no DOM (modal não aberto).  
**Causa raiz C:** Nominatim bloqueado por CORS (raro) ou rate limit (1 req/seg).

**Diagnóstico:**
```javascript
document.getElementById('agrEnderecoDrop')  // deve existir quando modal aberto
// Testar no console com modal aberto:
agendaEnderecoBuscar('Avenida Paulista')
```

---

## Checklist de Debug Geral

Antes de qualquer investigação profunda:

1. **Console do browser** — há algum erro visível?
2. **`typeof _part1Loaded === 'function'`** — bloco 1 carregou?
3. **`typeof _part2Loaded === 'function'`** — bloco 2 carregou?
4. **Último commit** — o que mudou? (`git log --oneline -5`)
5. **Revert de emergência** — `git revert HEAD --no-edit && git push`
