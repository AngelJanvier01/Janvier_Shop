#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_GIT_REMOTE="${BACKUP_GIT_REMOTE:-}"
BACKUP_GIT_BRANCH="${BACKUP_GIT_BRANCH:-main}"
BACKUP_AGE_RECIPIENT="${BACKUP_AGE_RECIPIENT:-}"
BACKUP_GIT_AUTHOR_NAME="${BACKUP_GIT_AUTHOR_NAME:-JANVIER Backup}"
BACKUP_GIT_AUTHOR_EMAIL="${BACKUP_GIT_AUTHOR_EMAIL:-backup@localhost}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ -n "${BACKUP_GIT_REMOTE}" ]] || fail "Falta BACKUP_GIT_REMOTE."
[[ -n "${BACKUP_AGE_RECIPIENT}" ]] || fail "Falta BACKUP_AGE_RECIPIENT."
[[ "${BACKUP_GIT_REMOTE}" == git@*:* ]] || fail "BACKUP_GIT_REMOTE debe usar SSH (git@host:owner/repo.git)."
[[ -f "${ROOT}/.env.production" ]] || fail "Falta ${ROOT}/.env.production."

for command in age docker git sha256sum; do
  command -v "${command}" >/dev/null 2>&1 || fail "Falta el comando requerido: ${command}."
done

source_remote="$(git -C "${ROOT}" remote get-url origin 2>/dev/null || true)"
[[ "${BACKUP_GIT_REMOTE}" != "${source_remote}" ]] || fail "El repositorio de respaldos debe ser distinto al repositorio principal."

workdir="$(mktemp -d "${TMPDIR:-/var/tmp}/janvier-backup.XXXXXX")"
case "${workdir}" in
  /tmp/janvier-backup.*|/var/tmp/janvier-backup.*) ;;
  *) fail "La carpeta temporal no es segura: ${workdir}" ;;
esac
cleanup() {
  rm -rf -- "${workdir}"
}
trap cleanup EXIT

plain="${workdir}/plain"
repository="${workdir}/repository"
mkdir -p "${plain}"

# This creates a PostgreSQL dump, private-assets archive and their checksum.
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
  age -r "${BACKUP_AGE_RECIPIENT}" -o "${snapshot}/${name}.age" "${file}"
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
  for file in "${snapshot}"/*.age; do
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
sha256sum "${snapshot}/manifest.json" > "${snapshot}/manifest.sha256"

relative_snapshot="snapshots/${stamp}"
git -C "${repository}" add -- "${relative_snapshot}"
git -C "${repository}" commit -m "backup: ${stamp}"
git -C "${repository}" push origin "${BACKUP_GIT_BRANCH}"

echo "Respaldo cifrado subido: ${relative_snapshot}"
