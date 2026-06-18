# Dockerfile do backend (Node.js + Express + PostgreSQL)
FROM node:20-alpine

WORKDIR /app

# Copia primeiro só o package.json para aproveitar cache de camadas do Docker
# (reinstala dependências só quando elas mudam, não a cada alteração de código)
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3001

# Roda como usuário não-root por segurança (boa prática em produção)
RUN addgroup -g 1001 -S nodejs && adduser -S csmanager -u 1001
USER csmanager

CMD ["node", "src/server.js"]
