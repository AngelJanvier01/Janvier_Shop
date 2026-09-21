#!/usr/bin/env bash

set -euo pipefail
umask 077

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT}/.env.production"
SNAPSHOT_DIR="${1:-}"
CONFIRMATION="${2:-}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ -d "${SNAPSHOT_DIR}" ]] || fail "Uso: $0 <directorio-descifrado> --confirm-destroy-existing-data"
[[ "${CONFIRMATION}" == "--confirm-destroy-existing-data" ]] || \
  fail "La restauración reemplaza los volúmenes actuales; falta --confirm-destroy-existing-data."
[[ -f "${ENV_FILE}" ]] || fail "Falta ${ENV_FILE}."

for command in docker sha256sum tar; do
  command -v "${command}" >/dev/null 2>&1 || fail "Falta el comando requerido: ${command}."
done

mapfile -t checksum_files < <(find "${SNAPSHOT_DIR}" -maxdepth 1 -type f -name 'janvier-*.sha256')
[[ "${#checksum_files[@]}" -eq 1 ]] || fail "Debe existir exactamente un manifiesto janvier-*.sha256."

(
  cd "${SNAPSHOT_DIR}"
  sha256sum --check "$(basename "${checksum_files[0]}")"
)

mapfile -t database_dumps < <(find "${SNAPSHOT_DIR}" -maxdepth 1 -type f -name 'janvier-postgres-*.dump')
mapfile -t proposal_archives < <(find "${SNAPSHOT_DIR}" -maxdepth 1 -type f -name 'janvier-proposal-assets-*.tar.gz')
mapfile -t document_archives < <(find "${SNAPSHOT_DIR}" -maxdepth 1 -type f -name 'janvier-customer-documents-*.tar.gz')
mapfile -t image_archives < <(find "${SNAPSHOT_DIR}" -maxdepth 1 -type f -name 'janvier-product-images-*.tar.gz')

[[ "${#database_dumps[@]}" -eq 1 ]] || fail "Debe existir exactamente un dump de PostgreSQL."
[[ "${#proposal_archives[@]}" -eq 1 ]] || fail "Debe existir exactamente un archivo de propuestas."
[[ "${#document_archives[@]}" -eq 1 ]] || fail "Debe existir exactamente un archivo de documentos."
[[ "${#image_archives[@]}" -eq 1 ]] || fail "Debe existir exactamente un archivo de imágenes."

for archive in "${proposal_archives[0]}" "${document_archives[0]}" "${image_archives[0]}"; do
  tar -tzf "${archive}" >/dev/null
  if tar -tzf "${archive}" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
    fail "El archivo contiene una ruta insegura: $(basename "${archive}")"
  fi
done

compose=(docker compose --env-file "${ENV_FILE}" -f "${ROOT}/compose.production.yaml")
"${compose[@]}" config -q

echo "Se detendrán los servicios y se reemplazarán únicamente los volúmenes del proyecto JANVIER."
"${compose[@]}" down --remove-orphans --volumes
"${compose[@]}" up -d --wait database

"${compose[@]}" exec -T database sh -c \
  'pg_restore --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < "${database_dumps[0]}"

"${compose[@]}" --profile maintenance run --rm --no-deps \
  -v "${SNAPSHOT_DIR}:/restore:ro" restore-storage sh -eu -c '
    rm -rf /var/lib/janvier/proposal-assets \
      /var/lib/janvier/customer-documents \
      /var/lib/janvier/product-images
    mkdir -p /var/lib/janvier
    tar -C /var/lib/janvier -xzf "/restore/'"$(basename "${proposal_archives[0]}")"'"
    tar -C /var/lib/janvier -xzf "/restore/'"$(basename "${document_archives[0]}")"'"
    tar -C /var/lib/janvier -xzf "/restore/'"$(basename "${image_archives[0]}")"'"
    chown -R 1001:1001 /var/lib/janvier/proposal-assets \
      /var/lib/janvier/customer-documents \
      /var/lib/janvier/product-images
  '

"${compose[@]}" build migrate
"${compose[@]}" --profile maintenance run --rm migrate npm run prisma:deploy
"${compose[@]}" build web background-removal image-worker sicodd-sync-worker \
  payment-expiration-worker email-worker
"${compose[@]}" up --no-build -d --wait --wait-timeout 600 web background-removal \
  image-worker sicodd-sync-worker payment-expiration-worker email-worker
"${compose[@]}" exec -T web wget -q -O /dev/null http://127.0.0.1:3001/api/health

echo "Restauración técnica completada. Ejecuta smoke, E2E seguro y validación funcional antes de abrir tráfico."
