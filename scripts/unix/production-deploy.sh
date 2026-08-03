#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT}/.env.production"

command -v docker >/dev/null 2>&1 || { echo "Docker no está disponible." >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker no está iniciado." >&2; exit 1; }
[[ -f "${ENV_FILE}" ]] || {
  echo "Falta .env.production. Copia .env.production.example y define secretos reales." >&2
  exit 1
}

compose=(docker compose --env-file "${ENV_FILE}" -f "${ROOT}/compose.production.yaml")
"${compose[@]}" config -q
"${compose[@]}" up -d database
"${compose[@]}" build migrate
"${compose[@]}" --profile maintenance run --rm migrate
"${compose[@]}" build web
"${compose[@]}" up --no-build -d --wait --wait-timeout 120 web
"${compose[@]}" exec -T web wget -q -O /dev/null http://127.0.0.1:3001/api/health

echo "JANVIER V2 está desplegado. Confirma HTTPS y el dominio antes de abrir tráfico público."
