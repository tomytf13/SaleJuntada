$ErrorActionPreference = "Stop"

$backendRoot = Split-Path -Parent $PSScriptRoot
$dataDirectory = Join-Path $backendRoot ".local-postgres"
$logPath = Join-Path $dataDirectory "postgres.log"
$port = 54329
$database = "sale_juntada_dev"
$databaseUser = "salejuntada"
$databasePassword = "salejuntada_dev"

function Resolve-PostgresTool([string]$name) {
  $command = Get-Command $name -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidate = Join-Path "C:\Program Files\pgsql\bin" "$name.exe"
  if (Test-Path -LiteralPath $candidate) {
    return $candidate
  }

  throw "No se encontró $name. Instalá PostgreSQL 15 o superior y agregá su carpeta bin al PATH."
}

$initdb = Resolve-PostgresTool "initdb"
$pgCtl = Resolve-PostgresTool "pg_ctl"
$pgIsReady = Resolve-PostgresTool "pg_isready"
$createdb = Resolve-PostgresTool "createdb"

& $pgIsReady -h 127.0.0.1 -p $port -d $database 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Output "PostgreSQL local ya está listo en 127.0.0.1:$port."
  exit 0
}

if (-not (Test-Path -LiteralPath (Join-Path $dataDirectory "PG_VERSION"))) {
  New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
  $passwordFile = Join-Path ([System.IO.Path]::GetTempPath()) "sale-juntada-postgres-$([guid]::NewGuid().ToString('N')).txt"
  try {
    [System.IO.File]::WriteAllText($passwordFile, $databasePassword)
    & $initdb -D $dataDirectory -U $databaseUser -A scram-sha-256 "--pwfile=$passwordFile" --encoding=UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) {
      throw "No se pudo inicializar PostgreSQL."
    }
  } finally {
    Remove-Item -LiteralPath $passwordFile -Force -ErrorAction SilentlyContinue
  }
}

& $pgCtl -D $dataDirectory -l $logPath -o "-p $port -h 127.0.0.1" start
if ($LASTEXITCODE -ne 0) {
  throw "No se pudo iniciar PostgreSQL. Revisá $logPath."
}

$ready = $false
for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
  & $pgIsReady -h 127.0.0.1 -p $port 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    break
  }
  Start-Sleep -Milliseconds 250
}

if (-not $ready) {
  throw "PostgreSQL no respondió a tiempo. Revisá $logPath."
}

$previousPgPassword = $env:PGPASSWORD
try {
  $env:PGPASSWORD = $databasePassword
  & $createdb -h 127.0.0.1 -p $port -U $databaseUser $database 2>$null
  if ($LASTEXITCODE -ne 0) {
    & $pgIsReady -h 127.0.0.1 -p $port -d $database 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "No se pudo crear la base $database."
    }
  }
} finally {
  $env:PGPASSWORD = $previousPgPassword
}

Write-Output "PostgreSQL local listo en 127.0.0.1:$port/$database."
