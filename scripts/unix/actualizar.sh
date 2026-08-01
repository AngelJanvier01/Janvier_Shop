#!/usr/bin/env bash

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

assert_docker_ready
initialize_development_environment
assert_web_port_available
compose pull database
compose build --pull
compose up -d database
wait_for_database
compose run --rm migrate
compose up --force-recreate --no-build -d web

echo "JANVIER V2 fue reconstruida con npm ci, migraciones aplicadas y servicios actualizados."
