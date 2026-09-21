#!/usr/bin/env bash

set -euo pipefail
umask 077

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
customer_documents_archive="${BACKUP_ROOT}/janvier-customer-documents-${stamp}.tar.gz"
product_images_archive="${BACKUP_ROOT}/janvier-product-images-${stamp}.tar.gz"

"${compose[@]}" exec -T database sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "${database_dump}"
[[ -s "${database_dump}" ]] || { echo "El dump de PostgreSQL quedó vacío." >&2; exit 1; }
"${compose[@]}" exec -T database pg_restore --list < "${database_dump}" >/dev/null
web_id="$("${compose[@]}" ps -q web)"
[[ -n "${web_id}" ]] || { echo "El servicio web debe estar activo para respaldar sus activos." >&2; exit 1; }
docker run --rm --volumes-from "${web_id}" -v "${BACKUP_ROOT}:/backup" alpine \
  tar -C /var/lib/janvier -czf "/backup/$(basename "${assets_archive}")" proposal-assets
docker run --rm --volumes-from "${web_id}" -v "${BACKUP_ROOT}:/backup" alpine \
  tar -C /var/lib/janvier -czf "/backup/$(basename "${customer_documents_archive}")" customer-documents
docker run --rm --volumes-from "${web_id}" -v "${BACKUP_ROOT}:/backup" alpine \
  tar -C /var/lib/janvier -czf "/backup/$(basename "${product_images_archive}")" product-images
for archive in "${assets_archive}" "${customer_documents_archive}" "${product_images_archive}"; do
  [[ -s "${archive}" ]] || { echo "El archivo quedó vacío: ${archive}" >&2; exit 1; }
  tar -tzf "${archive}" >/dev/null
done
(
  cd "${BACKUP_ROOT}"
  sha256sum "$(basename "${database_dump}")" "$(basename "${assets_archive}")" \
    "$(basename "${customer_documents_archive}")" "$(basename "${product_images_archive}")" \
    > "janvier-${stamp}.sha256"
)

echo "Respaldo creado: ${database_dump}, ${assets_archive}, ${customer_documents_archive} y ${product_images_archive}"
