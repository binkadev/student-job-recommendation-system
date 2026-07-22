[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$originalLocation = (Get-Location).Path

function Import-PerformanceEnvironment {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing $Path. Copy performance/.env.example to performance/.env first." }
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('#')) { continue }
        $separator = $trimmed.IndexOf('=')
        if ($separator -le 0) { throw "Invalid environment entry in $Path." }
        $key = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1).Trim()
        if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { throw "Invalid environment variable name '$key'." }
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) { $value = $value.Substring(1, $value.Length - 2) }
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

function Assert-PerformanceIdentity {
    if ($env:POSTGRES_DB -ne 'student_job_recommendation_perf') { throw 'POSTGRES_DB must be student_job_recommendation_perf.' }
    if ($env:POSTGRES_USER -ne 'perf_user') { throw 'POSTGRES_USER must be perf_user.' }
    if ($env:POSTGRES_PORT -ne '55432') { throw 'POSTGRES_PORT must be 55432.' }
}

try {
    $performanceRoot = Split-Path -Parent $PSScriptRoot
    $environmentFile = Join-Path $performanceRoot '.env'
    $composeFile = Join-Path $performanceRoot 'docker-compose.yml'
    Import-PerformanceEnvironment -Path $environmentFile
    Assert-PerformanceIdentity

    $health = (& docker inspect --format '{{.State.Health.Status}}' $env:PERF_POSTGRES_CONTAINER 2>$null)
    if ($LASTEXITCODE -ne 0 -or $health.Trim() -ne 'healthy') { throw 'Performance PostgreSQL is not healthy.' }

    $composeArguments = @('compose', '--env-file', $environmentFile, '-f', $composeFile)
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    & docker @composeArguments exec -T postgres psql `
        --username $env:POSTGRES_USER `
        --dbname $env:POSTGRES_DB `
        --set ON_ERROR_STOP=1 `
        --file '/performance/sql/00_guard.sql' `
        --file '/performance/sql/30_verify.sql'
    if ($LASTEXITCODE -ne 0) { throw "Dataset verification failed with exit code $LASTEXITCODE." }
    $timer.Stop()
    Write-Host ("Verification duration: {0:N3} seconds" -f $timer.Elapsed.TotalSeconds)
}
finally {
    Set-Location -LiteralPath $originalLocation
}
