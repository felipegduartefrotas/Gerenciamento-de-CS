# CS Manager — Creare Sistemas

Sistema de gestão de Customer Success. Backend Node.js/Express + PostgreSQL + frontend estático servido via Nginx, tudo orquestrado com Docker Compose.

## Estrutura

```
csmanager-app/
├── backend/          # API Node.js/Express
├── frontend/          # index.html + api.js, servidos via Nginx
├── db-init/           # scripts SQL rodados automaticamente na primeira inicialização do banco
├── scripts-migracao/   # script para trazer dados do app antigo (localStorage) para o Postgres
├── docker-compose.yml
├── .env.example
└── smoke-test.sh      # verificação rápida pós-deploy
```

## Pré-requisitos no servidor (VPS)

- Docker e Docker Compose instalados. Em uma VPS Ubuntu nova:
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```
  (o Docker Compose plugin já vem incluído nas versões recentes do Docker)

## Como subir o sistema

1. Envie esta pasta inteira para o servidor (via `scp`, `git clone`, ou upload do provedor da VPS).

2. Crie o arquivo de variáveis de ambiente a partir do exemplo:
   ```bash
   cp .env.example .env
   ```

3. Edite o `.env` e preencha `DB_PASSWORD` e `JWT_SECRET` com valores fortes e aleatórios. Gere cada um com:
   ```bash
   openssl rand -base64 32
   ```
   **Nunca** deixe os valores de exemplo do `.env.example` em produção.

4. Suba os 3 serviços (banco, backend, frontend):
   ```bash
   docker compose up -d --build
   ```
   A primeira vez demora um pouco mais (baixa as imagens base e instala dependências). As próximas inicializações são rápidas.

5. Confira que tudo subiu corretamente:
   ```bash
   docker compose ps
   ```
   Os 3 serviços (`db`, `backend`, `frontend`) devem aparecer com status "Up" (ou "healthy" no caso do `db`).

6. Rode a verificação automática:
   ```bash
   ./smoke-test.sh
   ```

7. Acesse `http://IP-DO-SEU-SERVIDOR` no navegador. Login inicial:
   - **E-mail:** felipe.duarte@crearesistemas.com.br
   - **Senha:** Creare2026!

   **Troque essa senha assim que possível** — crie um novo usuário administrador pela própria interface (tela de gestão de usuários) e, se quiser, remova ou altere a senha da conta padrão.

## Comandos úteis do dia a dia

| O que você quer fazer | Comando |
|---|---|
| Ver logs de tudo em tempo real | `docker compose logs -f` |
| Ver logs só do backend | `docker compose logs -f backend` |
| Reiniciar tudo | `docker compose restart` |
| Parar tudo (sem perder dados) | `docker compose down` |
| Subir de novo depois de parado | `docker compose up -d` |
| Atualizar depois de mudar código | `docker compose up -d --build` |
| Ver se os containers estão de pé | `docker compose ps` |

## Sobre persistência dos dados

Os dados do PostgreSQL ficam em um volume Docker nomeado (`csmanager_db_data`), que **sobrevive** a:
- `docker compose down`
- `docker compose restart`
- Reinicialização do servidor
- Atualizações de código (`docker compose up -d --build`)

Os dados só são perdidos se alguém rodar explicitamente `docker compose down -v` (o `-v` remove os volumes) ou apagar o volume manualmente. Isso não acontece em uso normal.

**Mesmo assim**, continue usando o botão de exportar backup dentro do próprio sistema (tela de Configurações) regularmente, como camada extra de segurança — guarde o arquivo `.json` gerado em um local fora do servidor (Google Drive, Dropbox, etc.).

## Migração de dados do app antigo (se você tiver clientes cadastrados na versão standalone)

Se você usou o app antigo (CSManager_Creare_v3.html, que guardava tudo no navegador via localStorage) e já tem clientes/reuniões/ações/NPS cadastrados lá, use o script em `scripts-migracao/migrar.js` para trazer esses dados para o Postgres novo. Veja as instruções detalhadas no topo do próprio arquivo do script — resumindo:

1. No app antigo, clique em "Exportar backup" (gera um `.json`)
2. Copie esse arquivo para a pasta `scripts-migracao/`
3. `cd scripts-migracao && npm install`
4. Rode com as variáveis de conexão do banco (veja exemplo completo no topo do script)

**Importante:** rodar o script duas vezes duplica todos os dados — ele só insere, nunca verifica duplicidade. Se precisar repetir, restaure o banco para o estado anterior primeiro.

## Revisão de segurança (auditoria interna, Junho/2026)

Antes de qualquer dado real entrar no sistema, foi feita uma revisão completa do código do backend. O que foi encontrado e corrigido:

- **Alertas com dispensa permanente** — ao dispensar um alerta (ex: "Health Score baixo"), ele nunca mais reaparecia para aquele cliente, mesmo que a situação piorasse depois. Corrigido: a dispensa agora expira em 7 dias.
- **Consultas N+1 na rota de alertas** — a verificação de alertas fazia múltiplas consultas separadas ao banco para cada cliente da carteira, o que ficaria lento conforme a base de clientes crescesse. Reescrita para buscar tudo em poucas consultas e processar em memória.
- **Armazenamento genérico sem limites** — a rota usada internamente pelo módulo de onboarding aceitava qualquer chave e qualquer tamanho de valor. Adicionado limite de tamanho (1MB por valor) e validação de formato de chave.

O que foi conferido e está correto:
- Todas as consultas ao banco usam parâmetros (`$1`, `$2`...), sem concatenação de texto vindo do usuário — protegido contra SQL injection.
- Senhas armazenadas com bcrypt, nunca em texto puro.
- Limite de tentativas de login (20 por 15 minutos) para dificultar força bruta.
- Rotas de gestão de usuários exigem papel de administrador.
- Token de sessão expira em 12 horas.

Nenhuma dessas correções exige nenhuma ação sua — já estão aplicadas no código deste pacote.

## Revisão de schema do banco

Uma segunda revisão, focada na estrutura do banco de dados em si (`db-init/01_schema.sql`), encontrou e corrigiu:

- **CNPJ duplicado era permitido** — era possível cadastrar o mesmo CNPJ em dois clientes diferentes sem nenhum aviso. Adicionado um índice único que impede isso, mas que continua permitindo deixar o CNPJ em branco (necessário para a importação por Excel, que tolera essa lacuna temporariamente). Tentar salvar um CNPJ já usado por outro cliente agora retorna uma mensagem clara em vez de um erro genérico.
- **Índices faltando** em campos usados pela Central de Alertas (categoria das ações e prazo das ações em atraso) — sem eles, a verificação de alertas faria uma busca completa na tabela de ações a cada chamada, o que ficaria perceptivelmente mais lento conforme o volume de ações cadastradas crescesse.

Assim como as correções de segurança, isso já está aplicado no código — nenhuma ação sua é necessária.

## O que ainda falta para um ambiente de produção mais robusto

Este pacote entrega o essencial para o sistema funcionar de ponta a ponta em uma VPS. Itens recomendados para depois, quando fizer sentido:

- **HTTPS com domínio próprio** — hoje o sistema responde em HTTP puro. Com um domínio apontado para a VPS, é possível adicionar HTTPS gratuito via Let's Encrypt/Certbot. Sem isso, a senha de login trafega sem criptografia entre o navegador e o servidor.
- **Backup automático do banco** — hoje o backup é manual (botão dentro do sistema). Um `cron` simples rodando `pg_dump` periodicamente adiciona uma camada extra de segurança.
- **Monitoramento básico** — alertas se algum dos 3 containers cair.

Nenhum desses itens impede o uso do sistema hoje; são reforços de segurança e resiliência para quando a operação crescer ou os dados se tornarem mais críticos.
