[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$originalLocation = (Get-Location).Path

function Import-PerformanceEnvironment {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Missing $Path. Copy performance/.env.example to performance/.env first."
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('#')) {
            continue
        }

        $separator = $trimmed.IndexOf('=')
        if ($separator -le 0) {
            throw "Invalid environment entry in $Path. Expected KEY=VALUE."
        }

        $key = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1).Trim()
        if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
            throw "Invalid environment variable name '$key' in $Path."
        }
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

function Assert-PerformanceIdentity {
    if ($env:POSTGRES_DB -ne 'student_job_recommendation_perf') {
        throw "Safety check failed: POSTGRES_DB must be student_job_recommendation_perf."
    }
    if ($env:POSTGRES_USER -ne 'perf_user') {
        throw "Safety check failed: POSTGRES_USER must be perf_user."
    }
    if ($env:POSTGRES_PORT -ne '55432') {
        throw "Safety check failed: POSTGRES_PORT must be 55432."
    }
    if ([string]::IsNullOrWhiteSpace($env:POSTGRES_PASSWORD)) {
        throw "Safety check failed: POSTGRES_PASSWORD must not be empty."
    }
}

function Assert-NativeSuccess {
    param([Parameter(Mandatory = $true)][string]$Operation)
    if ($LASTEXITCODE -ne 0) {
        throw "$Operation failed with exit code $LASTEXITCODE."
    }
}

try {
    $performanceRoot = Split-Path -Parent $PSScriptRoot
    $environmentFile = Join-Path $performanceRoot '.env'
    $composeFile = Join-Path $performanceRoot 'docker-compose.yml'

    Import-PerformanceEnvironment -Path $environmentFile
    Assert-PerformanceIdentity

    & docker version --format '{{.Server.Version}}' | Out-Null
    Assert-NativeSuccess -Operation 'Docker availability check'
    & docker compose version | Out-Null
    Assert-NativeSuccess -Operation 'Docker Compose availability check'

    $composeArguments = @('compose', '--env-file', $environmentFile, '-f', $composeFile)
    & docker @composeArguments up --detach postgres
    Assert-NativeSuccess -Operation 'Starting the performance PostgreSQL service'

    $deadline = [DateTime]::UtcNow.AddSeconds(90)
    do {
        $health = (& docker inspect --format '{{.State.Health.Status}}' $env:PERF_POSTGRES_CONTAINER 2>$null)
        if ($LASTEXITCODE -eq 0 -and $health.Trim() -eq 'healthy') {
            break
        }
        if ([DateTime]::UtcNow -ge $deadline) {
            throw "Performance PostgreSQL did not become healthy within 90 seconds."
        }
        Start-Sleep -Seconds 2
    } while ($true)

    $identity = & docker @composeArguments exec -T postgres psql `
        --username $env:POSTGRES_USER `
        --dbname $env:POSTGRES_DB `
        --tuples-only --no-align `
        --command "SELECT current_database() || ' | ' || current_user || ' | PostgreSQL ' || current_setting('server_version');"
    Assert-NativeSuccess -Operation 'Reading performance database identity'

    Write-Host 'Performance PostgreSQL is healthy.'
    Write-Host "Host: localhost"
    Write-Host "Port: $($env:POSTGRES_PORT)"
    Write-Host "Database: $($env:POSTGRES_DB)"
    Write-Host "User: $($env:POSTGRES_USER)"
    Write-Host "Identity: $($identity.Trim())"
}
finally {
    Set-Location -LiteralPath $originalLocation
}
