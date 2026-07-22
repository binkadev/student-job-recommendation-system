[CmdletBinding()]
param(
    [string]$ResultDirectory = $env:RESULT_DIRECTORY,
    [string]$BaseUrl = $(if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost:8080' }),
    [ValidateSet('auto', 'native', 'docker')][string]$K6RunnerKind = 'auto',
    [string]$K6VersionOutput,
    [string]$K6DockerImage
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib/k6-version.ps1')

function Import-PerformanceEnvironment([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing $Path." }
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('#')) { continue }
        $separator = $trimmed.IndexOf('=')
        if ($separator -le 0) { throw "Invalid environment entry in $Path." }
        $key = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1).Trim()
        if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { throw "Invalid environment key in $Path." }
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

function Assert-PerformanceIdentity {
    if ($env:POSTGRES_DB -ne 'student_job_recommendation_perf') { throw 'Refusing metadata collection: unexpected POSTGRES_DB.' }
    if ($env:POSTGRES_USER -ne 'perf_user') { throw 'Refusing metadata collection: unexpected POSTGRES_USER.' }
    if ($env:POSTGRES_PORT -ne '55432') { throw 'Refusing metadata collection: unexpected POSTGRES_PORT.' }
}

$performanceRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $performanceRoot
$environmentFile = Join-Path $performanceRoot '.env'
$composeFile = Join-Path $performanceRoot 'docker-compose.yml'
Import-PerformanceEnvironment $environmentFile
Assert-PerformanceIdentity

if ([string]::IsNullOrWhiteSpace($ResultDirectory)) {
    $timestampPart = Get-Date -Format 'yyyyMMdd-HHmmss'
    $shortSha = (& git -c "safe.directory=$($repositoryRoot.Replace('\', '/'))" -C $repositoryRoot rev-parse --short HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Unable to read Git SHA.' }
    $ResultDirectory = Join-Path $performanceRoot "results/baseline/$timestampPart-$shortSha"
}
elseif (-not [IO.Path]::IsPathRooted($ResultDirectory)) {
    $ResultDirectory = Join-Path $repositoryRoot $ResultDirectory
}
$ResultDirectory = [IO.Path]::GetFullPath($ResultDirectory)
foreach ($name in @('', 'smoke', 'query-count', 'explain', 'k6')) {
    [IO.Directory]::CreateDirectory((Join-Path $ResultDirectory $name)) | Out-Null
}

$safeRepository = $repositoryRoot.Replace('\', '/')
$gitSha = (& git -c "safe.directory=$safeRepository" -C $repositoryRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Unable to read Git SHA.' }
$gitBranch = (& git -c "safe.directory=$safeRepository" -C $repositoryRoot branch --show-current).Trim()
$gitStatusLines = @(& git -c "safe.directory=$safeRepository" -C $repositoryRoot status --short --untracked-files=all)
$gitState = if ($gitStatusLines.Count -eq 0) { 'clean' } else { 'dirty' }

$savedErrorPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$javaCommand = 'java'
if (-not [string]::IsNullOrWhiteSpace($env:JAVA_HOME)) {
    $javaHomeExecutable = Join-Path $env:JAVA_HOME 'bin/java.exe'
    if (Test-Path -LiteralPath $javaHomeExecutable -PathType Leaf) { $javaCommand = $javaHomeExecutable }
}
$javaVersion = ((& $javaCommand -version 2>&1) -join ' ').Trim()
$javaExitCode = $LASTEXITCODE
$ErrorActionPreference = $savedErrorPreference
if ($javaExitCode -ne 0) { $javaVersion = 'unavailable' }
$pom = Get-Content -LiteralPath (Join-Path $repositoryRoot 'backend/pom.xml') -Raw
$springMatch = [regex]::Match($pom, '<artifactId>spring-boot-starter-parent</artifactId>\s*<version>([^<]+)</version>')
$springBootVersion = if ($springMatch.Success) { $springMatch.Groups[1].Value.Trim() } else { 'unknown' }

$dockerVersion = (& docker version --format 'client={{.Client.Version}}; server={{.Server.Version}}' 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Docker is required to collect isolated database metadata.' }
$dockerComposeVersion = (& docker compose version --short 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose is required.' }

$k6Runtime = $null
if ($K6RunnerKind -eq 'auto') {
    if (-not [string]::IsNullOrWhiteSpace($K6VersionOutput) -or -not [string]::IsNullOrWhiteSpace($K6DockerImage)) {
        throw 'K6VersionOutput and K6DockerImage cannot be supplied when K6RunnerKind is auto.'
    }
    $k6Runtime = Resolve-K6Runtime
}
else {
    if ([string]::IsNullOrWhiteSpace($K6VersionOutput)) {
        throw 'Validated K6VersionOutput is required when K6RunnerKind is native or docker.'
    }
    $validatedVersion = Assert-K6VersionOutput -VersionOutput $K6VersionOutput -RunnerDescription "the supplied $K6RunnerKind runtime"
    if ($K6RunnerKind -eq 'docker') {
        if ($K6DockerImage -ne $script:PinnedK6DockerImage) {
            throw "Metadata must report the pinned Docker image $($script:PinnedK6DockerImage)."
        }
    }
    elseif (-not [string]::IsNullOrWhiteSpace($K6DockerImage)) {
        throw 'K6DockerImage must be empty for a native k6 runtime.'
    }
    $k6Runtime = [pscustomobject]@{
        Kind = $K6RunnerKind
        Version = $validatedVersion
        FullVersion = $K6VersionOutput
        DockerImage = if ($K6RunnerKind -eq 'docker') { $K6DockerImage } else { $null }
    }
}
$k6Version = $k6Runtime.FullVersion

$composeArguments = @('compose', '--env-file', $environmentFile, '-f', $composeFile)
& docker @composeArguments exec -T postgres psql --username $env:POSTGRES_USER --dbname $env:POSTGRES_DB --set ON_ERROR_STOP=1 --file '/performance/sql/00_guard.sql' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Performance database guard failed.' }

$databaseSql = @"
SELECT jsonb_build_object(
  'database', current_database(),
  'user', current_user,
  'postgresVersion', current_setting('server_version'),
  'latestFlywayMigration', (SELECT max(version::integer) FROM flyway_schema_history WHERE success),
  'rowCounts', jsonb_build_object(
    'users', (SELECT count(*) FROM users),
    'students', (SELECT count(*) FROM students),
    'student_profiles', (SELECT count(*) FROM student_profiles),
    'companies', (SELECT count(*) FROM companies),
    'skills', (SELECT count(*) FROM skills),
    'student_skills', (SELECT count(*) FROM student_skills),
    'jobs', (SELECT count(*) FROM jobs),
    'job_skills', (SELECT count(*) FROM job_skills),
    'saved_jobs', (SELECT count(*) FROM saved_jobs),
    'cv_files', (SELECT count(*) FROM cv_files),
    'applications', (SELECT count(*) FROM applications),
    'recommendation_runs', (SELECT count(*) FROM recommendation_runs),
    'recommendation_results', (SELECT count(*) FROM recommendation_results),
    'notifications', (SELECT count(*) FROM notifications)
  )
)::text;
"@
$databaseJson = (& docker @composeArguments exec -T postgres psql --username $env:POSTGRES_USER --dbname $env:POSTGRES_DB --tuples-only --no-align --set ON_ERROR_STOP=1 --command $databaseSql | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Unable to collect database metadata.' }
$database = $databaseJson | ConvertFrom-Json

try {
    $osRecord = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
    $operatingSystem = "$($osRecord.Caption) $($osRecord.Version)"
    $totalRamBytes = [int64]$osRecord.TotalVisibleMemorySize * 1KB
}
catch {
    $operatingSystem = [Environment]::OSVersion.VersionString
    $totalRamBytes = [GC]::GetGCMemoryInfo().TotalAvailableMemoryBytes
}
try {
    $cpuModel = (Get-CimInstance Win32_Processor -ErrorAction Stop | Select-Object -First 1 -ExpandProperty Name).Trim()
}
catch {
    $cpuModel = if ($env:PROCESSOR_IDENTIFIER) { $env:PROCESSOR_IDENTIFIER } else { 'unknown' }
}

$endpoints = @(
    [ordered]@{ name = 'jobs-list'; method = 'GET'; path = '/api/jobs?page=1&size=20'; authentication = 'STUDENT' },
    [ordered]@{ name = 'company-applications'; method = 'GET'; path = '/api/companies/me/applications?page=1&size=20&sort=appliedAt,desc'; authentication = 'COMPANY' },
    [ordered]@{ name = 'public-companies'; method = 'GET'; path = '/api/public/companies?page=1&size=20&sort=createdAt,desc'; authentication = 'none' }
)

$metadata = [ordered]@{
    testTimestamp = (Get-Date).ToUniversalTime().ToString('o')
    git = [ordered]@{ sha = $gitSha; branch = $gitBranch; state = $gitState }
    runtime = [ordered]@{
        java = $javaVersion
        springBoot = $springBootVersion
        docker = $dockerVersion
        dockerCompose = $dockerComposeVersion
        k6 = $k6Version
        k6Runner = $k6Runtime.Kind
        k6DockerImage = $k6Runtime.DockerImage
    }
    host = [ordered]@{
        operatingSystem = $operatingSystem
        cpuModel = $cpuModel
        logicalCpuCount = [Environment]::ProcessorCount
        totalRamBytes = $totalRamBytes
    }
    database = $database
    baseUrl = $BaseUrl
    endpoints = $endpoints
    phase = 'B1 measurement tooling validation; not a final baseline'
}

$metadataJsonPath = Join-Path $ResultDirectory 'metadata.json'
$metadataMarkdownPath = Join-Path $ResultDirectory 'metadata.md'
$metadata | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $metadataJsonPath -Encoding utf8

$rowLines = $database.rowCounts.PSObject.Properties | ForEach-Object { "| ``$($_.Name)`` | $($_.Value) |" }
$endpointLines = $endpoints | ForEach-Object { "| $($_.name) | ``$($_.method) $($_.path)`` | $($_.authentication) |" }
$markdown = @"
# Phase B1 Environment Metadata

> Correctness/tooling validation only. This is not a final performance baseline.

- Test timestamp (UTC): ``$($metadata.testTimestamp)``
- Git SHA: ``$gitSha``
- Git branch: ``$gitBranch``
- Working tree: ``$gitState``
- Java: ``$javaVersion``
- Spring Boot: ``$springBootVersion``
- PostgreSQL: ``$($database.postgresVersion)``
- Latest Flyway migration: ``$($database.latestFlywayMigration)``
- Docker: ``$dockerVersion``
- Docker Compose: ``$dockerComposeVersion``
- k6: ``$k6Version``
- k6 runner: ``$($k6Runtime.Kind)``
- k6 Docker image: ``$(if ($null -eq $k6Runtime.DockerImage) { 'not used' } else { $k6Runtime.DockerImage })``
- Operating system: ``$operatingSystem``
- CPU: ``$cpuModel``
- Logical CPUs: ``$([Environment]::ProcessorCount)``
- Total RAM bytes: ``$totalRamBytes``
- Database: ``$($database.database)``
- Database user: ``$($database.user)``
- Base URL: ``$BaseUrl``

## Database row counts

| Table | Rows |
|---|---:|
$($rowLines -join "`n")

## Selected requests

| Workload | Request | Authentication |
|---|---|---|
$($endpointLines -join "`n")

Final p50, p95, p99, error rate, throughput, response bytes, and query-count fields remain **TBD**.
"@
$markdown | Set-Content -LiteralPath $metadataMarkdownPath -Encoding utf8

Write-Host "Environment metadata written to $ResultDirectory"
