#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIRECTORY}/../.." && pwd)"
ENVIRONMENT_PATH="${PROJECT_ROOT}/.env"
ENVIRONMENT_EXAMPLE_PATH="${PROJECT_ROOT}/.env.example"

compose() {
  (
    cd "${PROJECT_ROOT}"
    docker compose --env-file "${ENVIRONMENT_PATH}" "$@"
  )
}

assert_docker_ready() {
  command -v docker >/dev/null 2>&1 || {
    echo "Docker no está instalado o no se encuentra en PATH." >&2
    exit 1
  }
  docker info >/dev/null 2>&1 || {
    echo "Docker no está iniciado. Inícialo y vuelve a ejecutar este script." >&2
    exit 1
  }
  docker compose version >/dev/null 2>&1 || {
    echo "Docker Compose V2 no está disponible." >&2
    exit 1
  }
}

initialize_development_environment() {
  if [[ ! -f "${ENVIRONMENT_PATH}" ]]; then
    cp "${ENVIRONMENT_EXAMPLE_PATH}" "${ENVIRONMENT_PATH}"
    echo "Se creó .env local desde .env.example."
  fi

  node - "${ENVIRONMENT_PATH}" <<'NODE'
const fs = require("node:fs");
const crypto = require("node:crypto");
const [path] = process.argv.slice(2);
let content = fs.readFileSync(path, "utf8");
if (!/^INITIAL_ADMIN_EMAIL=/m.test(content)) {
  content += '\nINITIAL_ADMIN_EMAIL="admin@janvier.local"\nINITIAL_ADMIN_PASSWORD="replace-with-a-strong-random-password"\n';
}

environment_value() {
  local name="$1"
  local value
  value="$(sed -n -E "s/^${name}=\"?([^\"]*)\"?$/\1/p" "${ENVIRONMENT_PATH}" | tail -n 1)"
  [[ -n "${value}" ]] || {
    echo "No se encontrÃ³ ${name} en .env." >&2
    exit 1
  }
  printf '%s' "${value}"
}

assert_web_port_available() {
  local port
  port="$(environment_value APP_PORT)"
  if ! command -v lsof >/dev/null 2>&1; then
    return
  fi
  local existing_web
  existing_web="$(compose ps -q web | tail -n 1)"
  local listeners
  listeners="$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "${listeners}" && -z "${existing_web}" ]]; then
    echo "APP_PORT=${port} ya estÃ¡ ocupado. DetÃ©n el proceso o cambia APP_PORT en .env antes de iniciar Docker." >&2
    exit 1
  fi
}
content = content.replace(
  'AUTH_SECRET="replace-with-a-strong-random-secret"',
  `AUTH_SECRET="${crypto.randomBytes(48).toString("base64url")}"`
);
content = content.replace(
  'INITIAL_ADMIN_PASSWORD="replace-with-a-strong-random-password"',
  `INITIAL_ADMIN_PASSWORD="${crypto.randomBytes(24).toString("base64url")}"`
);
fs.writeFileSync(path, content, "utf8");
NODE
  echo "Se verificaron los secretos locales y la contraseña inicial de administración en .env."
}

wait_for_database() {
  local deadline=$((SECONDS + 90))
  while ((SECONDS < deadline)); do
    local container_id
    container_id="$(compose ps -q database | tail -n 1)"
    if [[ -n "${container_id}" ]]; then
      local health
      health="$(docker inspect --format '{{.State.Health.Status}}' "${container_id}")"
      if [[ "${health}" == "healthy" ]]; then
        return
      fi
    fi
    sleep 2
  done

  echo "PostgreSQL no llegó a estado healthy. Revisa 'docker compose logs database'." >&2
  exit 1
}
