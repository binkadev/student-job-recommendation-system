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

function Assert-NativeSuccess {
    param([string]$Operation)
    if ($LASTEXITCODE -ne 0) { throw "$Operation failed with exit code $LASTEXITCODE." }
}

try {
    $performanceRoot = Split-Path -Parent $PSScriptRoot
    $environmentFile = Join-Path $performanceRoot '.env'
    $composeFile = Join-Path $performanceRoot 'docker-compose.yml'
    Import-PerformanceEnvironment -Path $environmentFile
    Assert-PerformanceIdentity

    & docker version --format '{{.Server.Version}}' | Out-Null
    Assert-NativeSuccess -Operation 'Docker availability check'
    $health = (& docker inspect --format '{{.State.Health.Status}}' $env:PERF_POSTGRES_CONTAINER 2>$null)
    if ($LASTEXITCODE -ne 0 -or $health.Trim() -ne 'healthy') { throw 'Performance PostgreSQL is not healthy.' }

    $composeArguments = @('compose', '--env-file', $environmentFile, '-f', $composeFile)
    function Invoke-PerformanceSql {
        param([Parameter(Mandatory = $true)][string]$FileName)
        & docker @composeArguments exec -T postgres psql `
            --username $env:POSTGRES_USER `
            --dbname $env:POSTGRES_DB `
            --set ON_ERROR_STOP=1 `
            --file "/performance/sql/$FileName"
        Assert-NativeSuccess -Operation "Executing $FileName"
    }

    Invoke-PerformanceSql -FileName '00_guard.sql'

    $seedTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Invoke-PerformanceSql -FileName '10_reset.sql'
    Invoke-PerformanceSql -FileName '20_seed_core.sql'
    $seedTimer.Stop()

    $verificationTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Invoke-PerformanceSql -FileName '30_verify.sql'
    $verificationTimer.Stop()

    Write-Host ("Reset and seed duration: {0:N3} seconds" -f $seedTimer.Elapsed.TotalSeconds)
    Write-Host ("Verification duration: {0:N3} seconds" -f $verificationTimer.Elapsed.TotalSeconds)
}
finally {
    Set-Location -LiteralPath $originalLocation
}
