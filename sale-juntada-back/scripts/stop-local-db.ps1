$ErrorActionPreference = "Stop"

$backendRoot = Split-Path -Parent $PSScriptRoot
$dataDirectory = Join-Path $backendRoot ".local-postgres"

if (-not (Test-Path -LiteralPath (Join-Path $dataDirectory "PG_VERSION"))) {
  Write-Output "No hay una base PostgreSQL local inicializada."
  exit 0
}

$pgCtlCommand = Get-Command pg_ctl -ErrorAction SilentlyContinue
$pgCtl = if ($pgCtlCommand) {
  $pgCtlCommand.Source
} else {
  "C:\Program Files\pgsql\bin\pg_ctl.exe"
}

if (-not (Test-Path -LiteralPath $pgCtl)) {
  throw "No se encontró pg_ctl."
}

& $pgCtl -D $dataDirectory stop -m fast
if ($LASTEXITCODE -ne 0) {
  throw "No se pudo detener PostgreSQL."
}

Write-Output "PostgreSQL local detenido."
