# Skill: Integrações e APIs Externas

Referência de todas as integrações externas do sistema: padrões de uso, estrutura de resposta e fallbacks.

---

## 1. CNPJ — cnpj.ws (primária)

**URL:** `https://publica.cnpj.ws/cnpj/{14_digitos}`  
**Método:** GET, sem autenticação  
**Uso:** Preenchimento automático do cadastro de cliente

### Estrutura de Resposta (campos usados)

```javascript
{
  "razao_social": "VALE S.A.",
  "natureza_juridica": { "id": "2046", "descricao": "Sociedade por Ações - Aberta" },
  "porte": { "id": "05", "descricao": "Demais" },  // "Demais" = Grande
  "estabelecimento": {
    "nome_fantasia": "VALE",              // ← está em estabelecimento, NÃO na raiz!
    "situacao_cadastral": "Ativa",
    "data_inicio_atividade": "1942-06-01",
    "tipo_logradouro": "Praça",           // ← concatenar com logradouro
    "logradouro": "TIRADENTES",
    "numero": "S/N",
    "complemento": "...",
    "bairro": "CENTRO",
    "cep": "35900010",
    "ddd1": "31", "telefone1": "38197027",
    "email": null,
    "atividade_principal": {              // pode ser OBJETO ou ARRAY
      "id": "0710-1/00",
      "descricao": "Extração de minério de ferro"
    },
    "municipio": { "nome": "Itabira" },
    "estado": { "sigla": "MG" }
  }
}
```

### Mapeamento para campos do formulário

| Campo API | Campo Formulário |
|-----------|-----------------|
| `j.razao_social` | `fRazao` |
| `est.nome_fantasia \|\| j.nome_fantasia` | `fFantasia` |
| `j.natureza_juridica.descricao` | `fNatJur` |
| `j.porte.descricao` (normalizar) | `fPorte` (select) |
| `est.situacao_cadastral` | `fSit` |
| `est.data_inicio_atividade` | `fAbert` |
| `est.atividade_principal` (obj ou array[0]) | `fCNAE` |
| `est.tipo_logradouro + ' ' + est.logradouro` | `fLogr` |
| `est.numero` | `fNum` |
| `est.complemento` | `fComp` |
| `est.bairro` | `fBairro` |
| `est.municipio.nome` | `fCidade` |
| `est.estado.sigla` | `fUF` |
| `est.cep` | `fCEP` |

### Normalização do Porte

```javascript
function _normPorte(p) {
  const n = (p || '').toLowerCase();
  if (n.includes('micro')) return 'Micro Empresa';
  if (n.includes('pequeno') || n.includes('epp')) return 'Empresa de Pequeno Porte';
  if (n.includes('medio') || n.includes('médio')) return 'Médio';
  if (n.includes('grande') || n.includes('demais')) return 'Grande';
  return '';
}
```

---

## 2. CNPJ — BrasilAPI (fallback)

**URL:** `https://brasilapi.com.br/api/cnpj/v1/{14_digitos}`  
**Método:** GET, sem autenticação  
**Uso:** Fallback quando cnpj.ws falha (CORS, timeout, 404)

### Estrutura de Resposta (campos usados)

```javascript
{
  "razao_social": "VALE S.A.",
  "nome_fantasia": "VALE",
  "natureza_juridica": "Sociedade por Ações - Aberta",  // ← string, não objeto
  "descricao_porte": "DEMAIS",
  "porte": "DEMAIS",
  "descricao_situacao_cadastral": "Ativa",
  "data_inicio_atividade": "1942-06-01",
  "cnae_fiscal": 710100,
  "cnae_fiscal_descricao": "Extração de minério de ferro",
  "descricao_tipo_de_logradouro": "Avenida",  // ← concatenar com logradouro
  "logradouro": "GRAÇA ARANHA",
  "numero": "26",
  "complemento": "ANDAR 01",
  "bairro": "CENTRO",
  "cep": "20030900",
  "municipio": "Rio de Janeiro",   // ← string, não objeto
  "uf": "RJ",
  "ddd_telefone_1": "(21) 37739500",
  "email": "..."
}
```

---

## 3. CEP — ViaCEP

**URL:** `https://viacep.com.br/ws/{8_digitos}/json/`  
**Método:** GET, sem autenticação  
**Uso:** (1) Busca manual de CEP; (2) Fallback de endereço após CNPJ

### Estrutura de Resposta

```javascript
{
  "cep": "01310-100",
  "logradouro": "Avenida Paulista",
  "complemento": "",
  "bairro": "Bela Vista",
  "localidade": "São Paulo",  // ← campo de cidade
  "uf": "SP",
  "erro": true  // ← só presente quando CEP inválido
}
```

### Padrão de uso

```javascript
async function buscarCEP() {
  const raw = document.getElementById('fCEP').value.replace(/\D/g, '');
  if (raw.length !== 8) return;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
    const d = await r.json();
    if (d.erro) throw new Error('cep_invalido');
    document.getElementById('fLogr').value = d.logradouro || '';
    document.getElementById('fBairro').value = d.bairro || '';
    document.getElementById('fCidade').value = d.localidade || '';
    // setar fUF e fRegiao também
  } catch(e) {
    // mostrar estado de erro
  }
}
```

---

## 4. Geocoding — Nominatim (OpenStreetMap)

**URL:** `https://nominatim.openstreetmap.org/search`  
**Método:** GET, sem autenticação  
**Rate limit:** 1 req/segundo (sem chave de API)  
**Usos:** (1) Autocomplete de endereço no modal de reunião; (2) Mapa do cadastro de cliente

### Parâmetros de busca

```
?format=json
&q=ENDEREÇO_CODIFICADO
&limit=6
&addressdetails=1
&countrycodes=br           # restringir ao Brasil
```

**Headers obrigatórios:**
```javascript
headers: { 'Accept-Language': 'pt-BR' }
```

### Estrutura de Resposta (item)

```javascript
{
  "place_id": 123,
  "lat": "-23.5505",
  "lon": "-46.6333",
  "display_name": "Avenida Paulista, Bela Vista, São Paulo, SP, 01310-100, Brasil",
  "address": {
    "road": "Avenida Paulista",
    "suburb": "Bela Vista",
    "city": "São Paulo",
    "state": "São Paulo",
    "postcode": "01310-100",
    "country_code": "br"
  }
}
```

### Padrão: Autocomplete com Debounce

```javascript
var _agrEndTimer = null;
function agendaEnderecoBuscar(q) {
  clearTimeout(_agrEndTimer);
  if (!q || q.length < 4) { /* esconder dropdown */ return; }
  _agrEndTimer = setTimeout(function() {
    fetch('https://nominatim.openstreetmap.org/search?format=json&q='
      + encodeURIComponent(q) + '&limit=6&addressdetails=1&countrycodes=br',
      { headers: { 'Accept-Language': 'pt-BR' } })
      .then(r => r.json())
      .then(function(data) { /* renderizar dropdown */ })
      .catch(function() { /* esconder dropdown */ });
  }, 350);  // debounce 350ms
}
```

### Padrão: Mapa Estático (iframe OSM)

```javascript
// Para mapa estático no cadastro de cliente (não usa Leaflet)
function atualizarMapa(cidade, uf, reg, logradouro, bairro) {
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`, ...)
    .then(data => {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      const d = 0.12;  // bounding box offset
      mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lon-d},${lat-d},${lon+d},${lat+d}&layer=mapnik&marker=${lat},${lon}`;
    });
}
```

---

## 5. Leaflet.js — Mapa Interativo

**CDN:** `https://unpkg.com/leaflet@1.9.4/dist/leaflet.min.js`  
**CSS:** `https://unpkg.com/leaflet@1.9.4/dist/leaflet.min.css`  
**Uso:** Mapa interativo na Agenda (reuniões presenciais com coordenadas)

### Padrão Singleton

```javascript
// window._agdMap guarda a instância — nunca inicializar duas vezes
if (!window._agdMap) {
  window._agdMap = L.map('agendaMapDiv', { scrollWheelZoom: false })
    .setView([-15.788, -47.879], 5);  // Brasil central
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(window._agdMap);
}
// Ao destruir:
if (window._agdMap) {
  try { window._agdMap.remove(); } catch(e) {}
  window._agdMap = null;
}
```

### Guard obrigatório antes de usar

```javascript
if (typeof L === 'undefined') {
  // Leaflet não carregou — mostrar estado vazio
  return;
}
```

### Dados salvos com coordenadas

Reuniões presenciais com endereço geocodificado têm `lat` e `lng` no objeto de ação:
```javascript
{
  modalidade: 'presencial',
  reuniaoEndereco: 'Avenida Paulista, 1000, São Paulo',
  lat: -23.5505,  // undefined se sem endereço
  lng: -46.6333,  // undefined se sem endereço
}
```

---

## 6. Chart.js — Gráficos

**CDN:** `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js`  
**Uso:** Dashboard (MRR, HS, volume de reuniões), NPS histórico, relatórios

### Padrão de instância

```javascript
// Destruir instância anterior antes de recriar
if (window._meuChart) { window._meuChart.destroy(); }
window._meuChart = new Chart(document.getElementById('meuChartCanvas'), {
  type: 'bar',  // bar, line, doughnut, pie, radar
  data: { labels: [...], datasets: [{ data: [...], ... }] },
  options: {
    responsive: true,
    maintainAspectRatio: false,  // height controlada pelo container
    plugins: { legend: { display: false } }
  }
});
```

---

## 7. XLSX.js — Importação de Excel

**CDN:** `https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js`  
**Uso:** Importação de carteira em lote via Excel/CSV

### Padrão de leitura

```javascript
const wb = XLSX.read(e.target.result, { type: 'array' });
const ws = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
const headers = raw[0].map(h => String(h).trim());
const rows = raw.slice(1).filter(r => r.some(c => String(c).trim() !== ''));
```

---

## Regiões do Brasil

```javascript
const REGIOES = {
  // Norte
  AC:'Norte', AM:'Norte', AP:'Norte', PA:'Norte', RO:'Norte', RR:'Norte', TO:'Norte',
  // Nordeste
  AL:'Nordeste', BA:'Nordeste', CE:'Nordeste', MA:'Nordeste',
  PB:'Nordeste', PE:'Nordeste', PI:'Nordeste', RN:'Nordeste', SE:'Nordeste',
  // Centro-Oeste
  DF:'Centro-Oeste', GO:'Centro-Oeste', MS:'Centro-Oeste', MT:'Centro-Oeste',
  // Sudeste
  ES:'Sudeste', MG:'Sudeste', RJ:'Sudeste', SP:'Sudeste',
  // Sul
  PR:'Sul', RS:'Sul', SC:'Sul'
};
```

---

## Headers Padrão para Fetch

```javascript
// APIs internas (v4 com JWT)
const headers = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + CS_DB.getToken()
};

// Nominatim (obrigatório identificar aplicação)
const headers = {
  'Accept-Language': 'pt-BR',
  'User-Agent': 'CSManagerCreare/3.0'
};
```
