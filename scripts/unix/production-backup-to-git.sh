#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_GIT_REMOTE="${BACKUP_GIT_REMOTE:-}"
BACKUP_GIT_BRANCH="${BACKUP_GIT_BRANCH:-main}"
BACKUP_AGE_RECIPIENT="${BACKUP_AGE_RECIPIENT:-}"
BACKUP_GIT_AUTHOR_NAME="${BACKUP_GIT_AUTHOR_NAME:-JANVIER Backup}"
BACKUP_GIT_AUTHOR_EMAIL="${BACKUP_GIT_AUTHOR_EMAIL:-backup@localhost}"
BACKUP_MAX_PART_BYTES="${BACKUP_MAX_PART_BYTES:-90000000}"
BACKUP_SECONDARY_PATH="${BACKUP_SECONDARY_PATH:-}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ -n "${BACKUP_GIT_REMOTE}" ]] || fail "Falta BACKUP_GIT_REMOTE."
[[ -n "${BACKUP_AGE_RECIPIENT}" ]] || fail "Falta BACKUP_AGE_RECIPIENT."
[[ "${BACKUP_SECONDARY_PATH}" == /* ]] || fail "BACKUP_SECONDARY_PATH debe ser una ruta absoluta."
[[ -d "${BACKUP_SECONDARY_PATH}" ]] || fail "No existe el almacenamiento secundario."
mountpoint -q "${BACKUP_SECONDARY_PATH}" || \
  fail "BACKUP_SECONDARY_PATH debe ser un montaje externo independiente."
[[ "${BACKUP_GIT_REMOTE}" == git@*:* ]] || fail "BACKUP_GIT_REMOTE debe usar SSH (git@host:owner/repo.git)."
[[ -f "${ROOT}/.env.production" ]] || fail "Falta ${ROOT}/.env.production."

for command in age docker git mountpoint sha256sum split; do
  command -v "${command}" >/dev/null 2>&1 || fail "Falta el comando requerido: ${command}."
done
[[ "${BACKUP_MAX_PART_BYTES}" =~ ^[0-9]+$ ]] || fail "BACKUP_MAX_PART_BYTES debe ser numérico."
(( BACKUP_MAX_PART_BYTES >= 1048576 && BACKUP_MAX_PART_BYTES < 100000000 )) || \
  fail "BACKUP_MAX_PART_BYTES debe estar entre 1 MiB y menos de 100 MB."

source_remote="$(git -C "${ROOT}" remote get-url origin 2>/dev/null || true)"
[[ "${BACKUP_GIT_REMOTE}" != "${source_remote}" ]] || fail "El repositorio de respaldos debe ser distinto al repositorio principal."

workdir="$(mktemp -d "${TMPDIR:-/var/tmp}/janvier-backup.XXXXXX")"
secondary_staging=""
case "${workdir}" in
  /tmp/janvier-backup.*|/var/tmp/janvier-backup.*) ;;
  *) fail "La carpeta temporal no es segura: ${workdir}" ;;
esac
cleanup() {
  if [[ -n "${secondary_staging}" && -d "${secondary_staging}" ]]; then
    rm -rf -- "${secondary_staging}"
  fi
  rm -rf -- "${workdir}"
}
trap cleanup EXIT

plain="${workdir}/plain"
repository="${workdir}/repository"
mkdir -p "${plain}"

# This creates a PostgreSQL dump plus proposal assets, customer fiscal documents,
# image derivatives and their checksum.
bash "${ROOT}/scripts/unix/production-backup.sh" "${plain}"

# Environment configuration is needed for disaster recovery, but is encrypted
# before it leaves this temporary directory.
install -m 600 "${ROOT}/.env.production" "${plain}/environment.production"

export GIT_TERMINAL_PROMPT=0
git clone --depth 1 --branch "${BACKUP_GIT_BRANCH}" "${BACKUP_GIT_REMOTE}" "${repository}"
git -C "${repository}" config user.name "${BACKUP_GIT_AUTHOR_NAME}"
git -C "${repository}" config user.email "${BACKUP_GIT_AUTHOR_EMAIL}"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
snapshot="${repository}/snapshots/${stamp}"
mkdir -p "${snapshot}"

encrypted_count=0
while IFS= read -r -d '' file; do
  name="$(basename "${file}")"
  encrypted="${workdir}/${name}.age"
  age -r "${BACKUP_AGE_RECIPIENT}" -o "${encrypted}" "${file}"
  split -b "${BACKUP_MAX_PART_BYTES}" -d -a 4 \
    "${encrypted}" "${snapshot}/${name}.age.part-"
  rm -f -- "${encrypted}"
  encrypted_count=$((encrypted_count + 1))
done < <(find "${plain}" -maxdepth 1 -type f -print0)
[[ "${encrypted_count}" -gt 0 ]] || fail "No se generaron archivos de respaldo."

source_revision="$(git -C "${ROOT}" rev-parse HEAD 2>/dev/null || printf 'unknown')"
{
  printf '{\n'
  printf '  "createdAt": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '  "sourceRevision": "%s",\n' "${source_revision}"
  printf '  "encryption": "age",\n'
  printf '  "files": [\n'
  first=true
  for file in "${snapshot}"/*.age.part-*; do
    if [[ "${first}" == true ]]; then
      first=false
    else
      printf ',\n'
    fi
    printf '    {"name":"%s","sha256":"%s","bytes":%s}' \
      "$(basename "${file}")" \
      "$(sha256sum "${file}" | awk '{print $1}')" \
      "$(stat -c '%s' "${file}")"
  done
  printf '\n  ]\n}\n'
} > "${snapshot}/manifest.json"
(
  cd "${snapshot}"
  sha256sum manifest.json > manifest.sha256
)

# Keep an independently mounted copy before attempting the Git push. This may
# be NFS, a provider-mounted object store, or removable encrypted storage, but
# never a directory on the same root filesystem.
secondary_snapshot="${BACKUP_SECONDARY_PATH}/${stamp}"
[[ ! -e "${secondary_snapshot}" ]] || fail "El snapshot secundario ya existe: ${stamp}."
secondary_staging="${BACKUP_SECONDARY_PATH}/.incoming-${stamp}-$$"
install -d -m 700 "${secondary_staging}"
cp -a -- "${snapshot}/." "${secondary_staging}/"
while IFS= read -r -d '' source_file; do
  destination_file="${secondary_staging}/$(basename "${source_file}")"
  [[ -f "${destination_file}" ]] || fail "Falta un archivo en la copia secundaria."
  [[ "$(sha256sum "${source_file}" | awk '{print $1}')" == \
    "$(sha256sum "${destination_file}" | awk '{print $1}')" ]] || \
    fail "La copia secundaria no coincide con el snapshot cifrado."
done < <(find "${snapshot}" -maxdepth 1 -type f -print0)
mv -- "${secondary_staging}" "${secondary_snapshot}"
secondary_staging=""

relative_snapshot="snapshots/${stamp}"
git -C "${repository}" add -- "${relative_snapshot}"
git -C "${repository}" commit -m "backup: ${stamp}"
git -C "${repository}" push origin "${BACKUP_GIT_BRANCH}"

echo "Respaldo cifrado guardado en almacenamiento secundario y Git: ${relative_snapshot}"
