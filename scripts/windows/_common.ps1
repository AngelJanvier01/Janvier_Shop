Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$script:EnvironmentPath = Join-Path $script:ProjectRoot ".env"
$script:EnvironmentExamplePath = Join-Path $script:ProjectRoot ".env.example"

function Invoke-ProjectCompose {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  Push-Location $script:ProjectRoot
  try {
    & docker compose --env-file $script:EnvironmentPath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Docker Compose terminó con código $LASTEXITCODE."
    }
  }
  finally {
    Pop-Location
  }
}

function Assert-DockerReady {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker Desktop no está instalado o no se encuentra en PATH."
  }

  & docker info *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop no está iniciado. Ábrelo y espera a que termine de arrancar."
  }

  & docker compose version *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose V2 no está disponible. Actualiza Docker Desktop."
  }
}

function Initialize-DevelopmentEnvironment {
  if (-not (Test-Path $script:EnvironmentPath)) {
    Copy-Item $script:EnvironmentExamplePath $script:EnvironmentPath
    Write-Host "Se creó .env local desde .env.example." -ForegroundColor Cyan
  }

  $content = Get-Content -LiteralPath $script:EnvironmentPath -Raw
  $changed = $false
  if ($content -notmatch '(?m)^INITIAL_ADMIN_EMAIL=') {
    $content = "$content`nINITIAL_ADMIN_EMAIL=`"admin@janvier.local`"`nINITIAL_ADMIN_PASSWORD=`"replace-with-a-strong-random-password`"`n"
    $changed = $true
  }

  if ($content -match 'AUTH_SECRET="replace-with-a-strong-random-secret"') {
    $bytes = [byte[]]::new(48)
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
      $random.GetBytes($bytes)
    }
    finally {
      $random.Dispose()
    }
    $secret = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
    $content = $content.Replace(
      'AUTH_SECRET="replace-with-a-strong-random-secret"',
      "AUTH_SECRET=`"$secret`""
    )
    $changed = $true
    Write-Host "Se generó un AUTH_SECRET local." -ForegroundColor Green
  }

  if ($content -match 'INITIAL_ADMIN_PASSWORD="replace-with-a-strong-random-password"') {
    $bytes = [byte[]]::new(24)
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
      $random.GetBytes($bytes)
    }
    finally {
      $random.Dispose()
    }
    $password = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
    $content = $content.Replace(
      'INITIAL_ADMIN_PASSWORD="replace-with-a-strong-random-password"',
      "INITIAL_ADMIN_PASSWORD=`"$password`""
    )
    $changed = $true
    Write-Host "Se generó una contraseña de administración local y se guardó en .env." -ForegroundColor Green
  }

  if ($changed) {
    Set-Content -LiteralPath $script:EnvironmentPath -NoNewline -Value $content
  }
}

function Wait-ForDatabase {
  $deadline = (Get-Date).AddSeconds(90)
  do {
    $containerId = (Invoke-ProjectCompose ps -q database | Select-Object -Last 1).Trim()
    if ($containerId) {
      $health = (& docker inspect --format '{{.State.Health.Status}}' $containerId).Trim()
      if ($health -eq "healthy") {
        return
      }
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  throw "PostgreSQL no llegó a estado healthy. Revisa 'docker compose logs database'."
}
