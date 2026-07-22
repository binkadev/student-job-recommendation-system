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
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('#')) { continue }
        $separator = $trimmed.IndexOf('=')
        if ($separator -le 0) { throw "Invalid environment entry in $Path. Expected KEY=VALUE." }
        $key = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1).Trim()
        if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { throw "Invalid environment variable name '$key' in $Path." }
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

function Assert-PerformanceIdentity {
    if ($env:POSTGRES_DB -ne 'student_job_recommendation_perf') { throw 'POSTGRES_DB must be student_job_recommendation_perf.' }
    if ($env:POSTGRES_USER -ne 'perf_user') { throw 'POSTGRES_USER must be perf_user.' }
    if ($env:POSTGRES_PORT -ne '55432') { throw 'POSTGRES_PORT must be 55432.' }
    if ([string]::IsNullOrWhiteSpace($env:POSTGRES_PASSWORD)) { throw 'POSTGRES_PASSWORD must not be empty.' }
}

function Assert-NativeSuccess {
    param([Parameter(Mandatory = $true)][string]$Operation)
    if ($LASTEXITCODE -ne 0) { throw "$Operation failed with exit code $LASTEXITCODE." }
}

try {
    $performanceRoot = Split-Path -Parent $PSScriptRoot
    $repositoryRoot = Split-Path -Parent $performanceRoot
    $environmentFile = Join-Path $performanceRoot '.env'
    $composeFile = Join-Path $performanceRoot 'docker-compose.yml'
    $configDirectory = (Resolve-Path -LiteralPath (Join-Path $performanceRoot 'config')).Path.Replace('\', '/')
    $backendRoot = Join-Path $repositoryRoot 'backend'
    $mavenWrapper = Join-Path $backendRoot 'mvnw.cmd'

    Import-PerformanceEnvironment -Path $environmentFile
    Assert-PerformanceIdentity

    if (-not (Test-Path -LiteralPath $mavenWrapper -PathType Leaf)) {
        throw "Maven wrapper not found at $mavenWrapper."
    }

    $health = (& docker inspect --format '{{.State.Health.Status}}' $env:PERF_POSTGRES_CONTAINER 2>$null)
    if ($LASTEXITCODE -ne 0 -or $health.Trim() -ne 'healthy') {
        throw 'Performance PostgreSQL is not healthy. Run performance/scripts/start-db.ps1 first.'
    }

    $composeArguments = @('compose', '--env-file', $environmentFile, '-f', $composeFile)
    $identity = & docker @composeArguments exec -T postgres psql `
        --username $env:POSTGRES_USER `
        --dbname $env:POSTGRES_DB `
        --tuples-only --no-align `
        --command "SELECT current_database() || ' | ' || current_user || ' | PostgreSQL ' || current_setting('server_version');"
    Assert-NativeSuccess -Operation 'Reading performance database identity'

    $env:SPRING_PROFILES_ACTIVE = 'performance'
    $env:SPRING_CONFIG_ADDITIONAL_LOCATION = "file:$configDirectory/"
    $env:SPRING_DATASOURCE_URL = "jdbc:postgresql://localhost:$($env:POSTGRES_PORT)/$($env:POSTGRES_DB)"
    $env:SPRING_DATASOURCE_USERNAME = $env:POSTGRES_USER
    $env:SPRING_DATASOURCE_PASSWORD = $env:POSTGRES_PASSWORD

    Write-Host 'Starting backend with isolated performance configuration.'
    Write-Host "SPRING_PROFILES_ACTIVE=$($env:SPRING_PROFILES_ACTIVE)"
    Write-Host "External config: $($env:SPRING_CONFIG_ADDITIONAL_LOCATION)"
    Write-Host "Database identity: $($identity.Trim())"
    Write-Host "JDBC target: jdbc:postgresql://localhost:$($env:POSTGRES_PORT)/$($env:POSTGRES_DB)"
    Write-Host 'The dev profile is not active; DataSeeder will not run.'

    Push-Location -LiteralPath $backendRoot
    try {
        & $mavenWrapper spring-boot:run
        Assert-NativeSuccess -Operation 'Starting the Spring Boot backend'
    }
    finally {
        Pop-Location
    }
}
finally {
    Set-Location -LiteralPath $originalLocation
}
