[CmdletBinding()]
param(
  [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$studioUrl = 'http://127.0.0.1:5173/archive-studio-local.html#/studio'
$studioProbeUrl = 'http://127.0.0.1:5173/archive-studio-local.html'
$apiProbeUrl = 'http://127.0.0.1:4176/api/studio/profiles'
$logRoot = Join-Path $env:TEMP 'YuArchive\ArchiveStudio'

function Test-LocalEndpoint([string]$Url) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
  } catch {
    return $false
  }
}

function Show-LaunchError([string]$Message) {
  $shell = New-Object -ComObject WScript.Shell
  [void]$shell.Popup($Message, 12, 'Archive Studio', 16)
}

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

if (-not (Test-LocalEndpoint $apiProbeUrl)) {
  Start-Process -FilePath 'node.exe' `
    -ArgumentList 'scripts/archive-studio-v0-server.mjs' `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logRoot 'api.log') `
    -RedirectStandardError (Join-Path $logRoot 'api-error.log')
}

if (-not (Test-LocalEndpoint $studioProbeUrl)) {
  Start-Process -FilePath 'npm.cmd' `
    -ArgumentList 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort' `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logRoot 'ui.log') `
    -RedirectStandardError (Join-Path $logRoot 'ui-error.log')
}

$ready = $false
for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
  if ((Test-LocalEndpoint $apiProbeUrl) -and (Test-LocalEndpoint $studioProbeUrl)) {
    $ready = $true
    break
  }
  Start-Sleep -Milliseconds 500
}

if (-not $ready) {
  Show-LaunchError 'Archive Studio could not start. Please retry. Diagnostic logs are in the system temp directory.'
  exit 1
}

if (-not $NoOpen) {
  Start-Process $studioUrl
}
