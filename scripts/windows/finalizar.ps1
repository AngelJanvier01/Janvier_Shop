param([switch]$RemoveData)

. "$PSScriptRoot\_common.ps1"

Assert-DockerReady
if ($RemoveData) {
  Invoke-ProjectCompose down --remove-orphans --volumes
  Write-Host "Servicios y volumen local eliminados. Los datos no son recuperables sin respaldo." -ForegroundColor Yellow
}
else {
  Invoke-ProjectCompose down --remove-orphans
  Write-Host "JANVIER V2 se detuvo. El volumen de PostgreSQL conserva todos los datos." -ForegroundColor Green
}
