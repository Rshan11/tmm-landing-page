# Sets the private visit-counter secrets on the tmm-landing-page Worker (run by MASONX, once).
# Reads STATS_KEY / STATS_SALT from "Site stats key.txt" in Downloads; never prints them.
# Usage: powershell -File "C:/landing pages/tmm/scripts/set-stats-key.ps1"
$ErrorActionPreference = 'Stop'
$keyFile = Join-Path $env:USERPROFILE 'Downloads\Site stats key.txt'
if (-not (Test-Path $keyFile)) { throw "Missing $keyFile" }
$lines = Get-Content $keyFile
$vals = @{}
foreach ($l in $lines) { if ($l -match '^(STATS_KEY|STATS_SALT)=(\S+)$') { $vals[$Matches[1]] = $Matches[2] } }
foreach ($name in 'STATS_KEY', 'STATS_SALT') {
  if (-not $vals[$name]) { throw "$name not found in $keyFile" }
}
Set-Location (Split-Path $PSScriptRoot -Parent)
foreach ($name in 'STATS_KEY', 'STATS_SALT') {
  $vals[$name] | npx wrangler secret put $name --name tmm-landing-page
  if ($LASTEXITCODE -ne 0) { throw "wrangler secret put $name failed" }
  Write-Host "$name set"
}
