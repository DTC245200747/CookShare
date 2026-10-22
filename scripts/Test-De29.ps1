param([switch]$Start, [switch]$SkipHttp, [string]$EvidenceDir = 'docs/report-evidence')
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$compose = @('compose','-f','docker-compose.yml','-f','docker-compose.monitoring.yml','--profile','tools')
$evidence = Join-Path $repo $EvidenceDir
New-Item -ItemType Directory -Force $evidence | Out-Null
$checks = [Collections.Generic.List[object]]::new()
function Record([string]$Name,[string]$Status,[string]$Detail) {
  $checks.Add([pscustomobject]@{check=$Name;status=$Status;detail=$Detail})
  Write-Host "$Status $Name - $Detail"
}
function Docker-Output([string[]]$Arguments) {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {$output = & docker @Arguments 2>&1}finally{$ErrorActionPreference=$previousPreference}
  if ($LASTEXITCODE -ne 0) { throw "Docker command failed: $($Arguments[0]) (exit $LASTEXITCODE)" }
  return ($output -join "`n")
}
Push-Location $repo
try {
  if (-not (Test-Path .env)) { throw 'Run scripts/Initialize-De29.ps1 first.' }
  $localEnv = @{}
  foreach($line in Get-Content .env) { if($line -match '^([A-Z_]+)=(.*)$'){$localEnv[$matches[1]]=$matches[2]} }
  foreach($key in @('DB_PASSWORD','MYSQL_ROOT_PASSWORD','JWT_SECRET','SEED_ADMIN_PASSWORD','DB_MIGRATION_PASSWORD','MYSQL_EXPORTER_PASSWORD','GRAFANA_ADMIN_PASSWORD')) {
    if (-not $localEnv[$key] -or $localEnv[$key] -match '(?i)replace-with|changeme' -or $localEnv[$key].Length -lt 20) { throw "Set a strong $key in .env; value was not printed." }
  }
  if($localEnv.JWT_SECRET.Length -lt 32){throw 'JWT_SECRET must be at least 32 characters.'}
  if([Text.Encoding]::UTF8.GetByteCount($localEnv.SEED_ADMIN_PASSWORD) -gt 72){throw 'SEED_ADMIN_PASSWORD must not exceed 72 UTF-8 bytes.'}
  foreach($key in @('DB_MIGRATION_PASSWORD','MYSQL_EXPORTER_PASSWORD')){if($localEnv[$key] -notmatch '^[A-Za-z0-9_-]{20,}$'){throw "$key must match the bootstrap-safe alphabet: letters, digits, underscore or hyphen."}}
  Record 'Environment' 'PASS' 'Required secrets present, non-placeholder and at least 20 characters; values omitted.'
  $null = Docker-Output ($compose + @('config','--quiet'))
  Record 'Compose config' 'PASS' 'Both Compose files and tools profile validate.'
  $null = Docker-Output @('info','--format','{{.OSType}}')
  if($Start) {
    $drive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($repo))
    if($drive.AvailableFreeSpace -lt 5GB){throw 'At least 5 GiB free disk space is required before building/pulling the full stack. Free space without deleting database volumes.'}
    $null = Docker-Output ($compose + @('up','-d','--build'))
    $null = Docker-Output ($compose + @('run','--rm','seed'))
  }
  $states = foreach($service in @('db','api','nginx','phpmyadmin','prometheus','grafana','loki','alloy','mysql-exporter','cadvisor','docker-socket-proxy')) {
    $id = (Docker-Output ($compose + @('ps','-q',$service))).Trim()
    if(-not $id){Record $service 'FAIL' 'No running container';continue}
    $container = (Docker-Output @('inspect',$id) | ConvertFrom-Json)[0]
    $health = if($container.State.Health){$container.State.Health.Status}else{'not configured'}
    $envNames = @($container.Config.Env | ForEach-Object {($_ -split '=',2)[0]})
    if($container.State.Status -eq 'running' -and $health -notin @('unhealthy','starting')) {Record $service 'PASS' "Running; health: $health"}else{Record $service 'FAIL' "State $($container.State.Status); health: $health"}
    [pscustomobject]@{service=$service;state=$container.State.Status;health=$health;user=$container.Config.User;readOnly=$container.HostConfig.ReadonlyRootfs;capDrop=$container.HostConfig.CapDrop;securityOpt=$container.HostConfig.SecurityOpt;ports=$container.HostConfig.PortBindings;networks=@($container.NetworkSettings.Networks.PSObject.Properties.Name);mounts=@($container.Mounts | Select-Object Type,Destination,RW);environmentNames=$envNames}
  }
  $states | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $evidence 'container-runtime.json')
  $fullConfig = (Docker-Output ($compose + @('--profile','seed','config','--format','json')) | ConvertFrom-Json)
  foreach($service in @('api','nginx','migrate','seed')) {
    $config = $fullConfig.services.$service
    if($config.cap_drop -notcontains 'ALL' -or $config.security_opt -notcontains 'no-new-privileges:true'){throw "Hardening missing on $service"}
  }
  Record 'Compose hardening declarations' 'PASS' 'API, Nginx, migration and seed drop ALL capabilities and request no-new-privileges.'
  if(-not $fullConfig.networks.database.internal){throw 'Database network must be internal'}
  foreach($service in @('db','api','mysql-exporter','cadvisor','alloy','docker-socket-proxy')){if($fullConfig.services.$service.ports){throw "Unexpected published port: $service"}}
  foreach($service in @('phpmyadmin','prometheus','grafana','loki')){foreach($port in $fullConfig.services.$service.ports){if($port.host_ip -ne '127.0.0.1'){throw "Management port must be loopback: $service"}}}
  Record 'Compose network isolation' 'PASS' 'Database network internal, only Nginx public, management endpoints loopback.'
  foreach($container in @($states | Where-Object {$_.service -in @('api','nginx','grafana','alloy')})) {
    if(-not $container.user -or $container.user -match '^(0|root)(:|$)'){throw "Expected a non-root container user: $($container.service)"}
  }
  if(@($states | Where-Object {$_.service -eq 'api' -and $_.state -eq 'running'}).Count -eq 0){throw 'Runtime probes NOT VERIFIED: API container is not running. Review Docker startup/disk failure first.'}
  $apiProbe = @'
import {pool} from './dist/config/db.js';
import {writeFile,unlink} from 'node:fs/promises';
if(process.getuid()===0)throw Error('API is root');
for(const key of ['MYSQL_ROOT_PASSWORD','DB_MIGRATION_PASSWORD','SEED_ADMIN_PASSWORD','GRAFANA_ADMIN_PASSWORD'])if(process.env[key])throw Error('Unexpected secret '+key);
try{
 const [counts]=await pool.query('SELECT COUNT(*) AS recipes FROM recipes');
 const [migrations]=await pool.query('SELECT name FROM schema_migrations ORDER BY name');
 try{await pool.query('CREATE TABLE de29_runtime_probe(id INT)');throw Error('DDL allowed');}catch(e){if(e.code!=='ER_TABLEACCESS_DENIED_ERROR')throw e;}
 await writeFile('uploads/de29-permission.tmp','probe');await unlink('uploads/de29-permission.tmp');
 let readOnly=false;try{await writeFile('/app/de29-denied.tmp','probe');}catch(e){if(e.code==='EROFS'||e.code==='EACCES')readOnly=true;else throw e;}
 if(!readOnly)throw Error('Root filesystem writable');
 console.log(JSON.stringify({uid:process.getuid(),recipes:counts[0].recipes,migrations,ddlDenied:true,uploadsWritable:true,rootFilesystemProtected:true,unnecessarySecretsAbsent:true}));
}finally{await pool.end()}
'@
  $probe = $apiProbe | & docker @compose exec -T api node --input-type=module 2>&1
  if($LASTEXITCODE -ne 0){throw 'Runtime/SQL hardening probe failed. No credentials were printed.'}
  $probe | Set-Content -Encoding UTF8 (Join-Path $evidence 'database-hardening.json')
  Record 'Runtime SQL and hardening' 'PASS' 'MySQL queried, DDL denied, non-root, root filesystem protected, uploads writable.'
  foreach($validation in @(@('nginx','nginx','-t'),@('prometheus','promtool','check','config','/etc/prometheus/prometheus.yml'),@('alloy','alloy','validate','/etc/alloy/config.alloy'),@('loki','/usr/bin/loki','-config.file=/etc/loki/loki.yml','-verify-config=true'))) {
    $null = Docker-Output ($compose + @('exec','-T') + $validation)
    Record ($validation[0]+' config') 'PASS' 'Runtime configuration validator succeeded.'
  }
  if(-not $SkipHttp) {
    $oldGrafana = $env:GRAFANA_ADMIN_PASSWORD
    try {
      $env:GRAFANA_ADMIN_PASSWORD = $localEnv.GRAFANA_ADMIN_PASSWORD
      $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
      $nodeBinary = if($nodeCommand){$nodeCommand.Source}else{Join-Path (Split-Path -Parent $repo) '.tools/node.exe'}
      $result = & $nodeBinary scripts/verify-stack.mjs 2>&1
      $result | Set-Content -Encoding UTF8 (Join-Path $evidence 'stack-http-checks.txt')
      if($LASTEXITCODE -ne 0){throw 'HTTP/metrics/log stack checks failed; see stack-http-checks.txt'}
      Record 'HTTP metrics dashboard LogQL' 'PASS' 'See stack-http-checks.txt; phpMyAdmin login/query requires browser evidence.'
    }finally{$env:GRAFANA_ADMIN_PASSWORD=$oldGrafana}
  }
}catch{Record 'Verification' 'FAIL' $_.Exception.Message}
finally{
  [pscustomobject]@{timestamp=[DateTimeOffset]::Now.ToString('o');checks=@($checks.ToArray())} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $evidence 'powershell-checks.json')
  Pop-Location
}
if(@($checks | Where-Object status -eq 'FAIL').Count){exit 1}
