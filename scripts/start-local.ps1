param([switch]$Build)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$toolRoot = Join-Path (Split-Path -Parent $repoRoot) '.tools'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodeBinary = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $toolRoot 'node.exe' }
if (-not (Test-Path -LiteralPath $nodeBinary)) { throw 'Install Node.js 22.16+ first.' }
$env:Path = (Split-Path -Parent $nodeBinary) + ';' + $env:Path
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
$portableNpm = Join-Path $toolRoot 'package/bin/npm-cli.js'
function Invoke-Npm([string[]]$NpmArgs) {
  if ($npmCommand) { & $npmCommand.Source @NpmArgs } else { & $nodeBinary $portableNpm @NpmArgs }
  if ($LASTEXITCODE -ne 0) { throw 'npm command failed.' }
}
$envPath = Join-Path $repoRoot 'backend/.env'
if (-not (Test-Path -LiteralPath $envPath)) { throw 'Copy .env.example to backend/.env and configure MySQL first. See README.md.' }
$localConfig = @{}
Get-Content -LiteralPath $envPath | ForEach-Object { if ($_ -match '^([A-Z_]+)=(.*)$') { $localConfig[$matches[1]] = $matches[2] } }
$appPort = if ($localConfig.PORT) { [int]$localConfig.PORT } else { 3000 }
$url = "http://localhost:$appPort/"
try { $running = Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 2; if ($running.StatusCode -eq 200 -and $running.Content.Contains('CookShare')) { Start-Process $url; Write-Host "CookShare is already running: $url"; return } } catch { }
if ($localConfig.DB_PORT -eq '3307' -and (Test-Path (Join-Path $toolRoot 'mysql-data'))) {
  $tcp = New-Object Net.Sockets.TcpClient
  try { $tcp.Connect('127.0.0.1',3307); $dbRunning=$true } catch { $dbRunning=$false } finally { $tcp.Dispose() }
  if (-not $dbRunning) {
    $mysqlBinary = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe'
    if (-not (Test-Path $mysqlBinary)) { throw 'Start your MySQL server before running CookShare.' }
    Start-Process -FilePath $mysqlBinary -ArgumentList @('--no-defaults',('--datadir="'+(Join-Path $toolRoot 'mysql-data')+'"'),'--port=3307','--bind-address=127.0.0.1','--mysqlx=OFF','--console') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $toolRoot 'mysql-web.out.log') -RedirectStandardError (Join-Path $toolRoot 'mysql-web.err.log') | Out-Null
  }
}
foreach ($component in @('backend','frontend')) {
  Push-Location (Join-Path $repoRoot $component)
  try {
    if (-not (Test-Path node_modules)) { Invoke-Npm -NpmArgs @('ci') }
    if ($Build -or -not (Test-Path dist)) { Invoke-Npm -NpmArgs @('run','build') }
  } finally { Pop-Location }
}
$logs = Join-Path $repoRoot 'logs'
New-Item -ItemType Directory -Force $logs | Out-Null
Start-Process -FilePath $nodeBinary -ArgumentList ('"'+(Join-Path $repoRoot 'backend/dist/server.js')+'"') -WorkingDirectory (Join-Path $repoRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'api.out.log') -RedirectStandardError (Join-Path $logs 'api.err.log') | Out-Null
for ($attempt=0; $attempt -lt 20; $attempt++) {
  try { $ready=Invoke-RestMethod ($url+'health/ready') -TimeoutSec 2; if ($ready.status -eq 'ready') { Start-Process $url; Write-Host "CookShare is ready: $url"; return } } catch { }
  Start-Sleep -Seconds 1
}
throw "CookShare did not become ready. Check $logs and the MySQL settings in backend/.env."
