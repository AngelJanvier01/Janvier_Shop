#!/usr/bin/env bash

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

assert_docker_ready
initialize_development_environment
compose up --build -d database
wait_for_database
compose run --rm migrate
compose build web
compose up --no-build -d web

echo "JANVIER V2 está disponible en el puerto configurado por APP_PORT en .env."
echo "PostgreSQL conserva sus datos en janvier_postgres; consulta POSTGRES_PORT en .env para el puerto local."
