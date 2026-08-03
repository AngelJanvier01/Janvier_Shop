#!/usr/bin/env bash

set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

assert_docker_ready
if [[ "${1:-}" == "--remove-data" ]]; then
  compose down --remove-orphans --volumes
  echo "Servicios, base y activos privados eliminados. No son recuperables sin respaldo."
else
  compose down --remove-orphans
  echo "JANVIER V2 se detuvo. PostgreSQL y activos privados permanecen en sus volúmenes."
fi
