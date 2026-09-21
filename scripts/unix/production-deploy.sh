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

env_value() {
  awk -v key="$1" '
    index($0, key "=") == 1 {
      value = substr($0, length(key) + 2)
      sub(/\r$/, "", value)
      sub(/^"/, "", value)
      sub(/"$/, "", value)
      print value
      exit
    }
  ' "${ENV_FILE}"
}

require_value() {
  local key="$1"
  local minimum="$2"
  local value
  value="$(env_value "${key}")"
  if (( ${#value} < minimum )) || [[ "${value}" == *replace-with* ]]; then
    echo "${key} falta o conserva un valor de ejemplo en .env.production." >&2
    exit 1
  fi
}

mode="$(stat -c '%a' "${ENV_FILE}")"
if (( (8#${mode} & 077) != 0 )); then
  echo ".env.production debe tener permisos 600 (actual: ${mode})." >&2
  exit 1
fi
require_value POSTGRES_PASSWORD 24
require_value AUTH_SECRET 32
require_value INITIAL_ADMIN_EMAIL 5
require_value INITIAL_ADMIN_PASSWORD 16
require_value NEXT_PUBLIC_SITE_URL 12
require_value APP_URL 12
require_value SICODD_USERNAME 1
require_value SICODD_ADMIN_PASSWORD 8
[[ "$(env_value NEXT_PUBLIC_SITE_URL)" == https://* ]] || {
  echo "NEXT_PUBLIC_SITE_URL debe usar HTTPS." >&2
  exit 1
}
[[ "$(env_value APP_URL)" == https://* ]] || {
  echo "APP_URL debe usar HTTPS." >&2
  exit 1
}
[[ "$(env_value INITIAL_ADMIN_EMAIL)" != *@example.com ]] || {
  echo "INITIAL_ADMIN_EMAIL conserva el dominio de ejemplo." >&2
  exit 1
}
[[ "$(env_value NEXT_PUBLIC_SITE_URL)" != *example.com* ]] || {
  echo "NEXT_PUBLIC_SITE_URL conserva el dominio de ejemplo." >&2
  exit 1
}
[[ "$(env_value APP_URL)" != *example.com* ]] || {
  echo "APP_URL conserva el dominio de ejemplo." >&2
  exit 1
}

mp_public_key="$(env_value MP_PUBLIC_KEY)"
mp_access_token="$(env_value MP_ACCESS_TOKEN)"
mp_webhook_secret="$(env_value MP_WEBHOOK_SECRET)"
if [[ -n "${mp_public_key}${mp_access_token}${mp_webhook_secret}" ]]; then
  require_value MP_PUBLIC_KEY 8
  require_value MP_ACCESS_TOKEN 16
  require_value MP_WEBHOOK_SECRET 16
fi

if [[ "$(env_value MAIL_ENABLED)" == "true" ]]; then
  require_value SMTP_HOST 3
  require_value SMTP_USER 5
  require_value SMTP_APP_PASSWORD 12
  require_value MAIL_FROM 5
  require_value MAIL_REPLY_TO 5
  require_value ALERT_RECIPIENTS 5
fi

compose=(docker compose --env-file "${ENV_FILE}" -f "${ROOT}/compose.production.yaml")
"${compose[@]}" config -q
"${compose[@]}" up -d database

if [[ -n "$("${compose[@]}" ps -q web)" ]]; then
  bash "${ROOT}/scripts/unix/production-backup.sh" "${ROOT}/backups/pre-deploy"
else
  backup_root="${ROOT}/backups/pre-deploy"
  mkdir -p "${backup_root}"
  chmod 700 "${backup_root}"
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  "${compose[@]}" exec -T database sh -c \
    'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' \
    > "${backup_root}/janvier-postgres-${stamp}.dump"
  echo "Respaldo previo de PostgreSQL creado antes de migrar."
fi

"${compose[@]}" build migrate
"${compose[@]}" --profile maintenance run --rm migrate
runtime_services=(
  web
  background-removal
  image-worker
  sicodd-sync-worker
  payment-expiration-worker
  email-worker
)
"${compose[@]}" build "${runtime_services[@]}"
"${compose[@]}" up --no-build -d --wait --wait-timeout 600 "${runtime_services[@]}"
"${compose[@]}" exec -T web wget -q -O /dev/null http://127.0.0.1:3001/api/health

echo "JANVIER V2 está desplegado. Confirma HTTPS y el dominio antes de abrir tráfico público."
