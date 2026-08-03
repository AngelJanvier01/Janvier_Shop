#!/usr/bin/env bash

set -euo pipefail

[[ "${EUID}" -eq 0 ]] || { echo "Ejecuta este script como root." >&2; exit 1; }

OPERATOR_USER="${1:-}"
PROJECT_ROOT="${2:-}"
BACKUP_REMOTE="${3:-git@github.com:AngelJanvier01/Janvier_Shop_Backups.git}"

[[ "${OPERATOR_USER}" =~ ^[a-z_][a-z0-9_-]*$ ]] || {
  echo "Usuario operador inválido." >&2
  exit 1
}
id "${OPERATOR_USER}" >/dev/null 2>&1 || {
  echo "No existe el usuario ${OPERATOR_USER}." >&2
  exit 1
}
[[ "${PROJECT_ROOT}" =~ ^/[A-Za-z0-9._/-]+$ ]] || {
  echo "La ruta del proyecto contiene caracteres no admitidos." >&2
  exit 1
}
[[ -f "${PROJECT_ROOT}/.env.production" ]] || {
  echo "Falta ${PROJECT_ROOT}/.env.production." >&2
  exit 1
}
[[ "${BACKUP_REMOTE}" =~ ^git@github\.com:[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\.git$ ]] || {
  echo "El remoto debe ser una URL SSH de GitHub." >&2
  exit 1
}

for command in age-keygen curl jq ssh-keygen; do
  command -v "${command}" >/dev/null 2>&1 || {
    echo "Falta el comando requerido: ${command}." >&2
    exit 1
  }
done

operator_home="$(getent passwd "${OPERATOR_USER}" | cut -d: -f6)"
[[ -d "${operator_home}" ]] || {
  echo "No se encontró el home de ${OPERATOR_USER}." >&2
  exit 1
}

config_dir="/etc/janvier-backup"
recovery_key="${operator_home}/JANVIER_BACKUP_RECOVERY_KEY.txt"
install -d -m 700 "${config_dir}"

if [[ ! -f "${config_dir}/id_ed25519" ]]; then
  ssh-keygen -q -t ed25519 -N "" -C "janvier-backup@$(hostname)" \
    -f "${config_dir}/id_ed25519"
fi
chmod 600 "${config_dir}/id_ed25519"
chmod 644 "${config_dir}/id_ed25519.pub"

if [[ ! -f "${recovery_key}" ]]; then
  umask 077
  age-keygen -o "${recovery_key}"
  chown "${OPERATOR_USER}:${OPERATOR_USER}" "${recovery_key}"
fi
chmod 600 "${recovery_key}"
recipient="$(age-keygen -y "${recovery_key}")"

meta_tmp="$(mktemp /var/tmp/janvier-github-meta.XXXXXX)"
known_hosts_tmp="$(mktemp /var/tmp/janvier-known-hosts.XXXXXX)"
env_tmp="$(mktemp /var/tmp/janvier-backup-env.XXXXXX)"
cleanup() {
  rm -f -- "${meta_tmp}" "${known_hosts_tmp}" "${env_tmp}"
}
trap cleanup EXIT

curl --fail --silent --show-error --location https://api.github.com/meta > "${meta_tmp}"
jq -r '.ssh_keys[] | "github.com " + .' "${meta_tmp}" > "${known_hosts_tmp}"
[[ -s "${known_hosts_tmp}" ]] || {
  echo "GitHub no devolvió claves SSH de host." >&2
  exit 1
}
install -m 644 "${known_hosts_tmp}" "${config_dir}/known_hosts"

{
  printf 'JANVIER_PROJECT_ROOT=%s\n' "${PROJECT_ROOT}"
  printf 'BACKUP_GIT_REMOTE=%s\n' "${BACKUP_REMOTE}"
  printf 'BACKUP_GIT_BRANCH=main\n'
  printf 'BACKUP_AGE_RECIPIENT=%s\n' "${recipient}"
  printf 'GIT_SSH_COMMAND="ssh -i /etc/janvier-backup/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/etc/janvier-backup/known_hosts"\n'
  printf 'BACKUP_GIT_AUTHOR_NAME=JANVIER Backup\n'
  printf 'BACKUP_GIT_AUTHOR_EMAIL=backup@janvier.local\n'
} > "${env_tmp}"
install -m 600 "${env_tmp}" /etc/janvier-backup.env

install -m 644 "${PROJECT_ROOT}/scripts/systemd/janvier-backup.service" \
  /etc/systemd/system/janvier-backup.service
install -m 644 "${PROJECT_ROOT}/scripts/systemd/janvier-backup.timer" \
  /etc/systemd/system/janvier-backup.timer
systemctl daemon-reload

echo "Configuración de respaldo preparada."
echo "Clave pública que debes registrar como Deploy key con escritura en GitHub:"
cat "${config_dir}/id_ed25519.pub"
echo "Clave privada de recuperación age (cópiala fuera del servidor): ${recovery_key}"
echo "El temporizador no se habilitó hasta verificar la Deploy key."
