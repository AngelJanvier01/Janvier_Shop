param([switch]$RemoveData)

. "$PSScriptRoot\_common.ps1"

Assert-DockerReady
if ($RemoveData) {
  Invoke-ProjectCompose down --remove-orphans --volumes
  Write-Host "Servicios, base y activos privados eliminados. No son recuperables sin respaldo." -ForegroundColor Yellow
}
else {
  Invoke-ProjectCompose down --remove-orphans
  Write-Host "JANVIER V2 se detuvo. PostgreSQL y activos privados permanecen en sus volÃºmenes." -ForegroundColor Green
}
