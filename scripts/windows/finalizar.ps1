. "$PSScriptRoot\_common.ps1"

Assert-DockerReady
Invoke-ProjectCompose down --remove-orphans
Write-Host "JANVIER V2 se detuvo. PostgreSQL y activos privados permanecen en sus volúmenes." -ForegroundColor Green
