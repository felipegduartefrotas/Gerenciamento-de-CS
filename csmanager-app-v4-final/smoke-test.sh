#!/bin/sh
# Script de verificação rápida após "docker compose up -d".
# Roda no próprio servidor, depois que os containers estiverem de pé.
# Uso: ./smoke-test.sh [porta]   (padrão: 80)

PORTA="${1:-80}"
BASE="http://localhost:$PORTA"

echo "Testando CS Manager em $BASE ..."
echo ""

echo -n "1. Frontend respondendo... "
if curl -sf "$BASE/" > /dev/null; then echo "OK"; else echo "FALHOU — verifique: docker compose logs frontend"; fi

echo -n "2. Backend respondendo (via proxy do frontend)... "
RESP=$(curl -s "$BASE/api/auth/login" -X POST -H "Content-Type: application/json" -d '{"email":"teste@teste.com","senha":"senha-errada"}')
if echo "$RESP" | grep -q "erro"; then echo "OK"; else echo "FALHOU — resposta inesperada: $RESP"; fi

echo -n "3. Banco de dados conectado... "
if docker compose exec -T db pg_isready -U csmanager > /dev/null 2>&1; then
  echo "OK"
else
  echo "FALHOU — rode: docker compose logs db"
fi

echo ""
echo "Se algum item falhou, rode: docker compose logs -f"
echo "Para testar o login de fato, acesse $BASE no navegador com felipe@creare.com.br / Creare2026!"
echo "IMPORTANTE: troque essa senha padrão assim que conseguir acessar o sistema."
