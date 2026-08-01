#!/usr/bin/env bash

set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

assert_docker_ready
if [[ "${1:-}" == "--remove-data" ]]; then
  compose down --remove-orphans --volumes
  echo "Servicios y volumen local eliminados. Los datos no son recuperables sin respaldo."
else
  compose down --remove-orphans
  echo "JANVIER V2 se detuvo. El volumen de PostgreSQL conserva todos los datos."
fi
