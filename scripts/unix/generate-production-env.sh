#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT}/.env.production"

domain="${1:-}"
admin_email="${2:-}"

if [[ -z "${domain}" || -z "${admin_email}" ]]; then
  echo "Uso: $0 <dominio> <correo-admin>" >&2
  exit 1
fi
if [[ ! "${domain}" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]]; then
  echo "Dominio no válido: ${domain}" >&2
  exit 1
fi
if [[ ! "${admin_email}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "Correo administrativo no válido: ${admin_email}" >&2
  exit 1
fi
if [[ -e "${ENV_FILE}" ]]; then
  echo "No se sobrescribió ${ENV_FILE}; ya existe." >&2
  exit 1
fi

command -v openssl >/dev/null 2>&1 || {
  echo "OpenSSL no está disponible." >&2
  exit 1
}

umask 077
database_password="$(openssl rand -hex 32)"
auth_secret="$(openssl rand -hex 48)"
admin_password="$(openssl rand -hex 20)"

{
  printf 'POSTGRES_USER="janvier"\n'
  printf 'POSTGRES_PASSWORD="%s"\n' "${database_password}"
  printf 'POSTGRES_DB="janvier_v2"\n'
  printf 'APP_PORT="3001"\n\n'
  printf 'AUTH_SECRET="%s"\n' "${auth_secret}"
  printf 'INITIAL_ADMIN_EMAIL="%s"\n' "${admin_email}"
  printf 'INITIAL_ADMIN_PASSWORD="%s"\n' "${admin_password}"
  printf 'NEXT_PUBLIC_SITE_URL="https://%s"\n' "${domain}"
  printf 'JANVIER_TIMEZONE="America/Mexico_City"\n'
} > "${ENV_FILE}"

chmod 600 "${ENV_FILE}"
echo "Se creó ${ENV_FILE} con secretos únicos y permisos 600."
