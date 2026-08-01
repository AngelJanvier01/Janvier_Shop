. "$PSScriptRoot\_common.ps1"

Assert-DockerReady
Initialize-DevelopmentEnvironment
Assert-WebPortIsAvailable
Invoke-ProjectCompose pull database
Invoke-ProjectCompose build --pull
Invoke-ProjectCompose up --detach database
Wait-ForDatabase
Invoke-ProjectCompose run --rm migrate
Invoke-ProjectCompose up --force-recreate --no-build --detach web

Write-Host "JANVIER V2 fue reconstruida con npm ci, migraciones aplicadas y servicios actualizados." -ForegroundColor Green
