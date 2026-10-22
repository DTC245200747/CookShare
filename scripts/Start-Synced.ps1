# Starts the already-synchronized system. No seed, rebuild, reset or volume deletion.
param([switch]$WithMonitoring, [switch]$WithTools)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Push-Location $repo
try {
  if(-not(Test-Path -LiteralPath 'docker-compose.synced.yml')){throw 'Synchronized configuration is missing.'}
  # The database is already imported and migrations verified; do not seed or
  # recreate unrelated services merely to reopen the synchronized website.
  docker compose -f docker-compose.yml -f docker-compose.monitoring.yml -f docker-compose.synced.yml up -d --no-deps --no-build db api nginx
  if($LASTEXITCODE -ne 0){throw 'Docker startup failed. Review Docker Desktop and local preserved images; do not reset volumes.'}
  if($WithMonitoring){
    docker compose -f docker-compose.yml -f docker-compose.monitoring.yml -f docker-compose.synced.yml up -d --no-deps --no-build prometheus grafana loki docker-socket-proxy alloy mysql-exporter cadvisor
    if($LASTEXITCODE -ne 0){throw 'Monitoring startup failed; the synchronized database and uploads are retained.'}
  }
  if($WithTools){
    docker compose -f docker-compose.yml -f docker-compose.monitoring.yml -f docker-compose.synced.yml --profile tools up -d --no-deps --no-build phpmyadmin
    if($LASTEXITCODE -ne 0){throw 'phpMyAdmin startup failed; do not reset the MySQL volume. Website remains independent of this tool.'}
  }
  Write-Host 'CookShare: http://localhost:8080'
  Write-Host 'Synchronized database: cookshare_sync_20261022121306_13d09f'
  Write-Host 'Use -WithMonitoring / -WithTools to explicitly start optional services.'
  Write-Host 'Grafana: http://localhost:3001'
}finally{Pop-Location}
