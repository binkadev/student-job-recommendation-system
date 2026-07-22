[CmdletBinding()]
param(
    [string]$ResultDirectory = $env:RESULT_DIRECTORY
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Import-PerformanceEnvironment([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing $Path." }
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('#')) { continue }
        $separator = $trimmed.IndexOf('=')
        if ($separator -le 0) { throw "Invalid environment entry in $Path." }
        $key = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1).Trim()
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

$performanceRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $performanceRoot
$environmentFile = Join-Path $performanceRoot '.env'
$composeFile = Join-Path $performanceRoot 'docker-compose.yml'
Import-PerformanceEnvironment $environmentFile

if ($env:POSTGRES_DB -ne 'student_job_recommendation_perf' -or $env:POSTGRES_USER -ne 'perf_user' -or $env:POSTGRES_PORT -ne '55432') {
    throw 'Refusing EXPLAIN capture: performance database identity guard failed.'
}

if ([string]::IsNullOrWhiteSpace($ResultDirectory)) {
    $runId = Get-Date -Format 'yyyyMMdd-HHmmss'
    $shortSha = (& git -c "safe.directory=$($repositoryRoot.Replace('\', '/'))" -C $repositoryRoot rev-parse --short HEAD).Trim()
    $ResultDirectory = Join-Path $performanceRoot "results/baseline/$runId-$shortSha"
}
elseif (-not [IO.Path]::IsPathRooted($ResultDirectory)) {
    $ResultDirectory = Join-Path $repositoryRoot $ResultDirectory
}
$explainDirectory = Join-Path ([IO.Path]::GetFullPath($ResultDirectory)) 'explain'
[IO.Directory]::CreateDirectory($explainDirectory) | Out-Null

$localK6 = @(Get-Process k6 -ErrorAction SilentlyContinue)
if ($localK6.Count -gt 0) { throw 'Stop k6 before capturing EXPLAIN plans.' }
$health = (& docker inspect --format '{{.State.Health.Status}}' $env:PERF_POSTGRES_CONTAINER 2>$null)
if ($LASTEXITCODE -ne 0 -or $health.Trim() -ne 'healthy') { throw 'Performance PostgreSQL is not healthy.' }

$composeArguments = @('compose', '--env-file', $environmentFile, '-f', $composeFile)
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmssfff')
$manifest = [ordered]@{
    phase = 'B1 EXPLAIN tooling validation; not a final baseline conclusion'
    capturedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    database = $env:POSTGRES_DB
    user = $env:POSTGRES_USER
    plans = @()
}

foreach ($endpoint in @('jobs-list', 'company-applications', 'public-companies')) {
    $containerFile = "/performance/sql/explain/$endpoint.sql"
    $rawOutput = (& docker @composeArguments exec -T postgres psql `
        --username $env:POSTGRES_USER `
        --dbname $env:POSTGRES_DB `
        --tuples-only --no-align `
        --pset 'pager=off' `
        --set ON_ERROR_STOP=1 `
        --file $containerFile | Out-String)
    if ($LASTEXITCODE -ne 0) { throw "EXPLAIN capture failed for $endpoint." }

    foreach ($kind in @('content', 'count', 'secondary')) {
        $pattern = "(?s)__PLAN_$($kind)_BEGIN__\s*(\[.*?\])\s*__PLAN_$($kind)_END__"
        $match = [regex]::Match($rawOutput, $pattern)
        if (-not $match.Success) { throw "Could not extract $kind JSON plan for $endpoint." }
        $json = $match.Groups[1].Value.Trim()
        $null = $json | ConvertFrom-Json
        $fileName = "$timestamp-$endpoint-$kind.json"
        $path = Join-Path $explainDirectory $fileName
        [IO.File]::WriteAllText($path, $json, [Text.UTF8Encoding]::new($false))
        $manifest.plans += [ordered]@{ endpoint = $endpoint; kind = $kind; file = $fileName }
    }
}

$manifestPath = Join-Path $explainDirectory "$timestamp-manifest.json"
$manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestPath -Encoding utf8
Write-Host "Read-only JSON EXPLAIN plans written to $explainDirectory"
