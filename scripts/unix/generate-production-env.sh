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

cp "${ROOT}/.env.production.example" "${ENV_FILE}"
sed -i \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=\"${database_password}\"|" \
  -e "s|^AUTH_SECRET=.*|AUTH_SECRET=\"${auth_secret}\"|" \
  -e "s|^INITIAL_ADMIN_EMAIL=.*|INITIAL_ADMIN_EMAIL=\"${admin_email}\"|" \
  -e "s|^INITIAL_ADMIN_PASSWORD=.*|INITIAL_ADMIN_PASSWORD=\"${admin_password}\"|" \
  -e "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=\"https://${domain}\"|" \
  -e "s|^APP_URL=.*|APP_URL=\"https://${domain}\"|" \
  "${ENV_FILE}"

chmod 600 "${ENV_FILE}"
echo "Completa SICODD, Gmail y Mercado Pago antes de activar esas funciones."
echo "Se creó ${ENV_FILE} con secretos únicos y permisos 600."
