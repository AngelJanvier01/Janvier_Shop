#!/usr/bin/env bash

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

assert_docker_ready
initialize_development_environment
compose up --build -d database
wait_for_database
compose run --rm migrate
compose up --build -d web

echo "JANVIER V2 está disponible en http://localhost:3001"
echo "PostgreSQL local escucha en localhost:5432 y conserva sus datos en janvier_postgres."
