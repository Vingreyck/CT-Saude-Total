#!/usr/bin/env bash
# Configura os tres servicos no Railway.
#
# Por que variaveis e nao railway.json: o Railway migrou do Nixpacks para o
# Railpack, e o arquivo de config so e lido quando o caminho esta preenchido a
# mao em cada servico. As variaveis RAILPACK_* valem sempre e dao para
# configurar por aqui, sem depender de ninguem lembrar de clicar.
#
# Pre-requisito: railway login, e o projeto linkado.
# Idempotente: pode rodar de novo sem medo.
set -euo pipefail

PG='${{Postgres.DATABASE_URL}}'

comum() {
  local servico="$1"
  railway variables --service "$servico" \
    --set "DATABASE_URL=$PG" \
    --set 'NODE_ENV=production' \
    --set 'TZ=America/Sao_Paulo' \
    --set 'RAILPACK_INSTALL_CMD=npm ci && npm run db:generate' >/dev/null
}

echo "configurando @ct/api"
comum '@ct/api'
railway variables --service '@ct/api' \
  --set 'RAILPACK_BUILD_CMD=npm run build:packages && npm run build -w @ct/api' \
  --set 'RAILPACK_START_CMD=npm run migrate:deploy -w @ct/db && npm run start -w @ct/api' >/dev/null

echo "configurando @ct/worker"
comum '@ct/worker'
railway variables --service '@ct/worker' \
  --set 'RAILPACK_BUILD_CMD=npm run build:packages && npm run build -w @ct/worker' \
  --set 'RAILPACK_START_CMD=npm run start -w @ct/worker' >/dev/null

echo "configurando @ct/web"
comum '@ct/web'
railway variables --service '@ct/web' \
  --set 'RAILPACK_BUILD_CMD=npm run build:packages && npm run build -w @ct/web' \
  --set 'RAILPACK_START_CMD=npm run start -w @ct/web' >/dev/null

echo
echo "pronto. so o servico api roda migration, de proposito: se os tres"
echo "rodarem, eles competem pela mesma migration e o deploy falha de forma"
echo "intermitente."
