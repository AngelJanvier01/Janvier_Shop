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

  if ! grep -q 'AUTH_SECRET="replace-with-a-strong-random-secret"' "${ENVIRONMENT_PATH}"; then
    return
  fi

  local secret
  secret="$(node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64url'))")"
  node - "${ENVIRONMENT_PATH}" "${secret}" <<'NODE'
const fs = require("node:fs");
const [path, secret] = process.argv.slice(2);
const content = fs.readFileSync(path, "utf8").replace(
  'AUTH_SECRET="replace-with-a-strong-random-secret"',
  `AUTH_SECRET="${secret}"`
);
fs.writeFileSync(path, content, "utf8");
NODE
  echo "Se generó un AUTH_SECRET local."
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
