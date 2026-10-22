param([string]$EnvFile = '.env')
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$target = if ([IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $repo $EnvFile }
if (Test-Path -LiteralPath $target) { throw 'Environment file already exists. Keep existing credentials; edit it manually if needed.' }
function New-Secret {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}
$secretKeys = @('DB_PASSWORD','MYSQL_ROOT_PASSWORD','JWT_SECRET','SEED_ADMIN_PASSWORD','DB_MIGRATION_PASSWORD','MYSQL_EXPORTER_PASSWORD','GRAFANA_ADMIN_PASSWORD')
$lines = Get-Content -LiteralPath (Join-Path $repo '.env.example')
$lines = foreach ($line in $lines) {
  if ($line -match '^([A-Z_]+)=') {
    $key = $matches[1]
    if ($secretKeys -contains $key) { "$key=$(New-Secret)"; continue }
    if ($key -eq 'CORS_ORIGIN') { 'CORS_ORIGIN=http://localhost:8080'; continue }
  }
  $line
}
[IO.File]::WriteAllLines($target, $lines, [Text.UTF8Encoding]::new($false))
Write-Output 'Created local environment with independent random secrets. Values were not printed. Never commit this file.'
