#!/usr/bin/env bash

set -euo pipefail
umask 077

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT}/.env.production"
POLL_SECONDS="${1:-60}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ -f "${ENV_FILE}" ]] || fail "Falta ${ENV_FILE}."
[[ "${POLL_SECONDS}" =~ ^[0-9]+$ ]] || fail "El intervalo debe ser numérico."
(( POLL_SECONDS >= 15 && POLL_SECONDS <= 3600 )) || \
  fail "El intervalo debe estar entre 15 y 3600 segundos."

for command in docker systemctl; do
  command -v "${command}" >/dev/null 2>&1 || fail "Falta el comando requerido: ${command}."
done

compose=(docker compose --env-file "${ENV_FILE}" -f "${ROOT}/compose.production.yaml")
"${compose[@]}" config -q

# Avoid taking the regular nightly snapshot while derivative files are still
# being replaced. The timer is always rearmed, including after an error.
restore_backup_timer() {
  systemctl start janvier-backup.timer >/dev/null 2>&1 || true
}
systemctl stop janvier-backup.timer
trap restore_backup_timer EXIT

while true; do
  read -r active_sync pending processing retry ready approved rejected dead < <(
    "${compose[@]}" exec -T database sh -lc \
      'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F " "' <<'SQL'
SELECT
  (SELECT count(*) FROM "SicoddSyncRun" WHERE status IN ('QUEUED', 'RUNNING')),
  count(*) FILTER (WHERE status = 'PENDING'),
  count(*) FILTER (WHERE status = 'PROCESSING'),
  count(*) FILTER (WHERE status = 'RETRY'),
  count(*) FILTER (WHERE status = 'READY'),
  count(*) FILTER (WHERE status = 'APPROVED'),
  count(*) FILTER (WHERE status = 'REJECTED'),
  count(*) FILTER (WHERE status = 'DEAD')
FROM "ProductImageDerivative";
SQL
  )

  printf '%s active_sync=%s pending=%s processing=%s retry=%s ready=%s approved=%s rejected=%s dead=%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${active_sync}" "${pending}" "${processing}" \
    "${retry}" "${ready}" "${approved}" "${rejected}" "${dead}"

  if (( active_sync == 0 && pending == 0 && processing == 0 && retry == 0 )); then
    break
  fi
  sleep "${POLL_SECONDS}"
done

# Return the temporary bulk-processing capacity to the normal production size
# before creating the consistent database and storage snapshot.
"${compose[@]}" up -d --no-build \
  --scale background-removal=1 \
  --scale image-worker=1 \
  background-removal image-worker

systemctl start --wait janvier-backup.service
systemctl is-failed --quiet janvier-backup.service && \
  fail "El respaldo final terminó con error."

restore_backup_timer
trap - EXIT
echo "Importación de catálogo procesada y respaldo final completado."
