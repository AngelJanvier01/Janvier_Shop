. "$PSScriptRoot\_common.ps1"

Assert-DockerReady
Initialize-DevelopmentEnvironment
Invoke-ProjectCompose pull database
Invoke-ProjectCompose build --pull
Invoke-ProjectCompose up -d database
Wait-ForDatabase
Invoke-ProjectCompose run --rm migrate
Invoke-ProjectCompose up --force-recreate -d web

Write-Host "JANVIER V2 fue reconstruida con npm ci, migraciones aplicadas y servicios actualizados." -ForegroundColor Green
