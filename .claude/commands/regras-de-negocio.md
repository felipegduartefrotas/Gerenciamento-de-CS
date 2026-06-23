# Skill: Regras de Negócio e Fluxos

Regras de negócio do CS Manager. Consultar antes de qualquer alteração em cálculos, status ou fluxos.

---

## Contexto de Negócio

**Empresa:** Creare Sistemas — tecnologia para gestão de frotas (telemetria, videomonitoramento, segurança).  
**Produto:** CS Manager — ferramenta interna para equipe de Customer Success.  
**Carteira:** clientes B2B de alto valor (mineração, logística, transporte, agronegócio).  
**Objetivo:** Reduzir churn, aumentar expansão, garantir adoção dos produtos Creare.

---

## Health Score (0–100)

O Health Score é o principal indicador de saúde de um cliente. Calculado automaticamente.

### Fatores de Cálculo (v3)

```javascript
function _recalcHS(clienteId) {
  // Componentes:
  // 1. Recência de contato (última reunião):
  //    0 dias → 30 pts | 1-15 dias → 25 pts | 16-30 dias → 20 pts
  //    31-45 dias → 12 pts | 46-60 dias → 5 pts | >60 dias → 0 pts
  //
  // 2. CSAT médio (últimas 3 reuniões):
  //    ≥8.5 → 35 pts | ≥7 → 28 pts | ≥5 → 18 pts
  //    ≥3 → 10 pts | <3 → 3 pts
  //
  // 3. Zona de NPS (último NPS registrado):
  //    ≥75 (Excelência) → 35 pts | ≥50 (Qualidade) → 28 pts
  //    ≥1 (Aperfeiçoamento) → 15 pts | ≤0 (Crítica) → 5 pts | sem NPS → 15 pts
}
```

### Faixas de Interpretação

| Score | Faixa | Cor | Significado |
|-------|-------|-----|-------------|
| ≥70 | Verde | `--green` | Cliente saudável |
| 40–69 | Amarelo | `--yellow` | Atenção — risco moderado |
| <40 | Vermelho | `--red` | Crítico — intervenção urgente |

---

## NPS (Net Promoter Score)

### Zonas NPS

| Nota | Zona | Cor |
|------|------|-----|
| 9–10 | Promotor | Verde |
| 7–8 | Neutro | Amarelo |
| 0–6 | Detrator | Vermelho |

**Score NPS = % Promotores − % Detratores**

### Zonas de Score NPS

| Score | Zona | Prioridade |
|-------|------|------------|
| ≤0 | Crítica | Urgente |
| 1–49 | Aperfeiçoamento | Alta |
| 50–74 | Qualidade | Normal |
| ≥75 | Excelência | Monitorar |

---

## Status de Clientes

### Ciclo de Vida

```
Implantação → Ativo → [Expansão | Em Risco] → Cancelado
```

- **Implantação:** cliente novo, ainda em onboarding
- **Ativo:** cliente operando normalmente
- **Expansão:** cliente com potencial de upsell identificado
- **Em Risco:** sinais de churn (HS baixo, NPS crítico, atraso em pagamento)
- **Cancelado:** contrato encerrado (não aparece nas métricas ativas)

### Regra: Clientes Cancelados
- Não contam para MRR total
- Não geram alertas
- Ficam na base mas não aparecem no dashboard principal

---

## Alertas Dinâmicos

Alertas são gerados em tempo real (`CS_DB._gerarAlertas()`) baseados no estado atual dos dados. Não são persistidos — só o dismiss é salvo.

### Tipos de Alerta

| Tipo | Trigger | Prioridade |
|------|---------|------------|
| `hs_baixo` | Health Score < 50 | Alta/Urgente |
| `sem_contato` | Sem reunião há >45 dias | Alta |
| `reuniao_hoje` | Reunião agendada para hoje | Urgente |
| `reuniao_atrasada` | Reunião agendada passou sem ser tratada | Urgente |
| `acoes_atrasadas` | Ações com prazo vencido | Alta |
| `renovacao_proxima` | Data de renovação em ≤30 dias | Alta |
| `churn_critico` | Churn Score ≥70% | Urgente |

### Dismiss de Alertas
- Dismiss expira em **7 dias** (não é permanente)
- ID do alerta é baseado no estado (`hs_cli_xxx`, `reun_hoje_xxx`, etc.)
- Alertas resolvidos desaparecem automaticamente (sem dismiss necessário)

---

## Plano de Ação (Kanban)

### Colunas do Kanban

```
Pendente → Em Andamento → Concluído
```

(Cancelada é um status mas não aparece no board principal)

### Categorias de Ação

- **null** (padrão): ação de melhoria/CS
- **`reuniao_agendada`**: reunião futura agendada (aparece também na Agenda)

### Reuniões Agendadas vs Realizadas

| Tipo | Armazenamento | Local |
|------|---------------|-------|
| Reunião futura | `CS_DB.get('acoes')` com `categoria='reuniao_agendada'` | Kanban + Agenda |
| Reunião realizada | `CS_DB.get('reunioes')` | Reuniões + Agenda (histórico) |

**Fluxo:** Agendar reunião → card no Kanban → quando ocorre → "Tratar" → converte em reunião realizada → card marcado Concluído.

### Devolutiva de Área

Quando uma ação requer envolvimento de outra área (Operações, Produto, Financeiro):

```javascript
// Estrutura de devolutiva salva em a.devolutivas[]
{
  tipo: 'solicitacao' | 'resposta',
  paraArea: 'Operações',      // só em solicitacao
  mensagem: 'Texto...',
  em: '2026-06-23T...',
  por: 'Felipe Duarte'
}
```

Estado do badge:
- Sem devolutivas → botão "Escalar para área responsável"
- Com solicitação sem resposta → badge amarelo "Aguardando resposta"
- Com resposta → badge verde "Devolutiva recebida"

---

## Churn Score

Score de probabilidade de cancelamento calculado por `calcChurnScore(cliente)`:

| Fator | Peso |
|-------|------|
| Health Score < 40 | +30 |
| Health Score 40–70 | +15 |
| Sem contato >60 dias | +25 |
| NPS Crítico (≤0) | +25 |
| NPS Aperfeiçoamento | +10 |
| Status "Em Risco" | +20 |
| Ações atrasadas (>2) | +15 |
| Renovação em <30 dias com HS<60 | +15 |

Score ≥70%: alerta de Churn Crítico gerado automaticamente.

---

## Tiers de Cliente

| Tier | Critério típico | MRR Esperado |
|------|-----------------|--------------|
| Enterprise | Grandes frotas, contratos plurianuais | Alto |
| Mid-Market | Médias empresas, contratos anuais | Médio |
| SMB | Pequenas empresas, contratos mensais | Baixo |

Tier influencia a frequência de contato recomendada no alerta "sem_contato".

---

## Segmentos Suportados

`Transporte e Logística`, `Mineração`, `Florestal`, `Agronegócio`, `Utilities`, `Construção`, `Sucroenergético`, `Farmacêutica`, `Outro`

---

## Modalidade de Reunião

| Modalidade | Badge | Cor |
|------------|-------|-----|
| `online` | Online | Azul (#5059c9) |
| `presencial` | Presencial | Verde (--green) |

Reuniões presenciais com endereço geocodificado aparecem no **mapa Leaflet** da página Agenda.

---

## Fluxo de Onboarding

```
Criação do cliente → Novo Onboarding → Definir escopo → Adicionar etapas
→ Marcar progresso (%) → Concluir onboarding → Status muda para "Ativo"
```

Etapas são JSONB livres. Progresso é calculado manualmente (não automático).

---

## Papéis de Usuário (v4)

| Papel | Permissões |
|-------|------------|
| `admin` | Tudo + gestão de usuários + configurações |
| `consultor` | Tudo exceto gestão de usuários |

**Dados em MAIÚSCULAS:** todos os campos de texto são armazenados em uppercase (exceto e-mail). Conversão feita no momento do save.
