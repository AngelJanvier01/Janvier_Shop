#!/usr/bin/env bash

set -euo pipefail
umask 077

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT}/.env.production"
CONFIRMATION="${1:-}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ "${CONFIRMATION}" == "--confirm-schema-compatible" ]] || \
  fail "Uso: $0 --confirm-schema-compatible"
[[ -f "${ENV_FILE}" ]] || fail "Falta ${ENV_FILE}."
[[ "$(stat -c '%a' "${ENV_FILE}")" == "600" ]] || \
  fail ".env.production debe tener permisos 600."
command -v docker >/dev/null 2>&1 || fail "Docker no está disponible."

compose=(docker compose --env-file "${ENV_FILE}" -f "${ROOT}/compose.production.yaml")
"${compose[@]}" config -q
bash "${ROOT}/scripts/unix/production-backup.sh" "${ROOT}/backups/pre-rollback"

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

web_binding="$("${compose[@]}" port web 3001)"
[[ "${web_binding}" == 127.0.0.1:* ]] || \
  fail "El servicio web no quedó limitado a 127.0.0.1: ${web_binding}"
if database_binding="$("${compose[@]}" port database 5432 2>/dev/null)" && \
  [[ -n "${database_binding}" ]]; then
  fail "PostgreSQL no debe publicar puertos: ${database_binding}"
fi

echo "Rollback de código aplicado sin ejecutar migraciones ni semillas."
