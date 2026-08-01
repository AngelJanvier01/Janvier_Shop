. "$PSScriptRoot\_common.ps1"

Assert-DockerReady
Initialize-DevelopmentEnvironment
Invoke-ProjectCompose up --build -d database
Wait-ForDatabase
Invoke-ProjectCompose run --rm migrate
Invoke-ProjectCompose up --build -d web

Write-Host "JANVIER V2 está disponible en http://localhost:3001" -ForegroundColor Green
Write-Host "PostgreSQL local escucha en localhost:5432 y conserva sus datos en el volumen janvier_postgres."
