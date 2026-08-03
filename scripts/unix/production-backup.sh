#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT}/.env.production"
BACKUP_ROOT="${1:-${ROOT}/backups/production}"

[[ -f "${ENV_FILE}" ]] || { echo "Falta .env.production." >&2; exit 1; }
mkdir -p "${BACKUP_ROOT}"
chmod 700 "${BACKUP_ROOT}"

compose=(docker compose --env-file "${ENV_FILE}" -f "${ROOT}/compose.production.yaml")
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
database_dump="${BACKUP_ROOT}/janvier-postgres-${stamp}.dump"
assets_archive="${BACKUP_ROOT}/janvier-proposal-assets-${stamp}.tar.gz"

"${compose[@]}" exec -T database sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "${database_dump}"
web_id="$("${compose[@]}" ps -q web)"
[[ -n "${web_id}" ]] || { echo "El servicio web debe estar activo para respaldar sus activos." >&2; exit 1; }
docker run --rm --volumes-from "${web_id}" -v "${BACKUP_ROOT}:/backup" alpine \
  tar -C /var/lib/janvier -czf "/backup/$(basename "${assets_archive}")" proposal-assets
sha256sum "${database_dump}" "${assets_archive}" > "${BACKUP_ROOT}/janvier-${stamp}.sha256"

echo "Respaldo creado: ${database_dump} y ${assets_archive}"
