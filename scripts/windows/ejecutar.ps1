. "$PSScriptRoot\_common.ps1"

Assert-DockerReady
Initialize-DevelopmentEnvironment
Assert-WebPortIsAvailable
Invoke-ProjectCompose up --build --detach database
Wait-ForDatabase
Invoke-ProjectCompose build migrate
Invoke-ProjectCompose run --rm migrate
Invoke-ProjectCompose build web
Invoke-ProjectCompose up --no-build --detach web

Write-Host "JANVIER V2 está disponible en el puerto configurado por APP_PORT en .env." -ForegroundColor Green
Write-Host "PostgreSQL y los activos privados persisten en los volÃºmenes janvier_postgres y janvier_proposal_assets."
