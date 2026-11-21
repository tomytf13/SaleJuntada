$ErrorActionPreference = "Stop"
node (Join-Path $PSScriptRoot "generate-pwa-icons.mjs")
exit $LASTEXITCODE
