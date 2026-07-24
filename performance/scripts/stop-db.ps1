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
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

try {
    $performanceRoot = Split-Path -Parent $PSScriptRoot
    $environmentFile = Join-Path $performanceRoot '.env'
    $composeFile = Join-Path $performanceRoot 'docker-compose.yml'
    Import-PerformanceEnvironment -Path $environmentFile

    if ($env:POSTGRES_DB -ne 'student_job_recommendation_perf' -or $env:POSTGRES_USER -ne 'perf_user' -or $env:POSTGRES_PORT -ne '55432') {
        throw 'Safety check failed: performance database identity is not exact.'
    }

    $composeArguments = @('compose', '--env-file', $environmentFile, '-f', $composeFile)
    & docker @composeArguments down
    if ($LASTEXITCODE -ne 0) { throw "Stopping performance services failed with exit code $LASTEXITCODE." }

    Write-Host 'Performance services stopped. The dedicated data volume was preserved.'
    Write-Host 'To delete the disposable volume too, run:'
    Write-Host 'docker compose --env-file performance/.env -f performance/docker-compose.yml down --volumes'
}
finally {
    Set-Location -LiteralPath $originalLocation
}
