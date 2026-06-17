# CS Manager — Creare Sistemas

Sistema de gestão de Customer Success para carteira de clientes de telemetria avançada (Creare Sistemas).

## Como rodar

Este é um app **client-side único** (HTML + CSS + JS vanilla), sem backend nem banco de dados separados. Todos os dados ficam salvos no `localStorage` do navegador onde o app é aberto.

- **Local:** abra `index.html` direto no navegador.
- **GitHub Pages:** habilite em Settings → Pages → Deploy from a branch → `main` → `/ (root)`.

## ⚠️ Importante sobre os dados

- Os dados (clientes, reuniões, NPS, ações, etc.) ficam **vinculados ao navegador/computador onde foram inseridos** — não há sincronização entre dispositivos nem servidor central.
- Abrir o link do GitHub Pages em outro computador **não traz os dados já cadastrados**.
- Use a função de **Backup/Exportar** dentro do app (gera um `.json`) para mover dados entre máquinas, e **Importar Backup** para restaurar.

## Stack

- HTML5 + CSS3 + JavaScript (vanilla, sem frameworks)
- Chart.js (gráficos)
- XLSX.js (importação de planilhas Excel)
- `localStorage` como camada de persistência (engine `CS_DB` interna)

## Funcionalidades

Dashboard executivo, gestão de carteira de clientes, controle de churn com Health Score, NPS (geral e por cliente), reuniões (registradas e agendadas com alertas automáticos), plano de ação em Kanban, onboarding, timeline auditável por cliente, relatórios (operacional para o cliente e confidencial para diretoria), backup/restauração manual.
