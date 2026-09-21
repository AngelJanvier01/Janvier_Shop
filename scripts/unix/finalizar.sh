#!/usr/bin/env bash

set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

assert_docker_ready
compose down --remove-orphans
echo "JANVIER V2 se detuvo. PostgreSQL y activos privados permanecen en sus volúmenes."
