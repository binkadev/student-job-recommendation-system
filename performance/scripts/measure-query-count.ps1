[CmdletBinding()]
param(
    [string]$BaseUrl = $(if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost:8080' }),
    [string]$ResultDirectory = $env:RESULT_DIRECTORY,
    [string]$StudentEmail = $(if ($env:STUDENT_EMAIL) { $env:STUDENT_EMAIL } else { 'perf.student.0001@example.test' }),
    [string]$CompanyEmail = $(if ($env:COMPANY_EMAIL) { $env:COMPANY_EMAIL } else { 'perf.company.001@example.test' }),
    [string]$PerformancePassword = $env:PERFORMANCE_PASSWORD
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib/measurement-lock.ps1')

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

function Assert-PerformanceIdentity {
    if ($env:POSTGRES_DB -ne 'student_job_recommendation_perf') { throw 'Refusing query capture: unexpected POSTGRES_DB.' }
    if ($env:POSTGRES_USER -ne 'perf_user') { throw 'Refusing query capture: unexpected POSTGRES_USER.' }
    if ($env:POSTGRES_PORT -ne '55432') { throw 'Refusing query capture: unexpected POSTGRES_PORT.' }
}

function Invoke-PsqlCommand([string]$Sql) {
    $output = (& docker @script:ComposeArguments exec -T postgres psql `
        --username $env:POSTGRES_USER `
        --dbname $env:POSTGRES_DB `
        --tuples-only --no-align `
        --set ON_ERROR_STOP=1 `
        --command $Sql | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Performance database SQL command failed.' }
    return $output
}

function Invoke-Login([string]$Email) {
    $body = @{ email = $Email; password = $PerformancePassword } | ConvertTo-Json -Compress
    $response = Invoke-WebRequest -Method Post -Uri "$($BaseUrl.TrimEnd('/'))/api/auth/login" -ContentType 'application/json' -Body $body -UseBasicParsing
    $json = $response.Content | ConvertFrom-Json
    if ($response.StatusCode -ne 200 -or $json.success -ne $true -or [string]::IsNullOrWhiteSpace($json.data.token)) {
        throw "Authentication setup failed for the required performance role (HTTP $($response.StatusCode))."
    }
    return [string]$json.data.token
}

function Assert-NoConcurrentMeasurement {
    Assert-NoExternalK6Workload

    $activeSql = [int](Invoke-PsqlCommand @"
SELECT count(*)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state = 'active'
  AND query NOT ILIKE '%pg_stat_activity%';
"@)
    if ($activeSql -ne 0) { throw "Detected $activeSql concurrent active SQL statement(s)." }
}

function Test-PagedResponse($Response, [string]$EndpointName) {
    if ($Response.StatusCode -ne 200) { throw "$EndpointName returned HTTP $($Response.StatusCode)." }
    try { $body = $Response.Content | ConvertFrom-Json }
    catch { throw "$EndpointName did not return valid JSON." }
    if ($body.success -ne $true -or $null -eq $body.data -or $null -eq $body.data.items) {
        throw "$EndpointName returned an invalid API/page structure."
    }
    if (@($body.data.items).Count -eq 0) { throw "$EndpointName returned empty page content." }
    if ($body.errorCode -in @('UNAUTHORIZED', 'ACCESS_DENIED')) { throw "$EndpointName returned an authentication error." }
    return $body
}

$performanceRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $performanceRoot
$environmentFile = Join-Path $performanceRoot '.env'
$composeFile = Join-Path $performanceRoot 'docker-compose.yml'
Import-PerformanceEnvironment $environmentFile
Assert-PerformanceIdentity

$baseUri = $null
if (-not [Uri]::TryCreate($BaseUrl, [UriKind]::Absolute, [ref]$baseUri)) { throw 'BASE_URL must be an absolute URL.' }
if ($baseUri.Host -notin @('localhost', '127.0.0.1') -or $baseUri.Port -ne 8080) {
    throw 'Query-count capture is restricted to the local performance backend on port 8080.'
}
if ([string]::IsNullOrWhiteSpace($PerformancePassword)) { throw 'PERFORMANCE_PASSWORD is required and is never written to output.' }

$measurementLease = $null
$studentToken = $null
$companyToken = $null
try {
    $measurementLease = Enter-PerformanceMeasurementLock -PerformanceRoot $performanceRoot -LockKind 'query-count' -WorkloadType 'query-count-diagnostics'
    Assert-NoExternalK6Workload

    if ([string]::IsNullOrWhiteSpace($ResultDirectory)) {
        $runId = Get-Date -Format 'yyyyMMdd-HHmmss'
        $shortSha = (& git -c "safe.directory=$($repositoryRoot.Replace('\', '/'))" -C $repositoryRoot rev-parse --short HEAD).Trim()
        $ResultDirectory = Join-Path $performanceRoot "results/baseline/$runId-$shortSha"
    }
    elseif (-not [IO.Path]::IsPathRooted($ResultDirectory)) {
        $ResultDirectory = Join-Path $repositoryRoot $ResultDirectory
    }
    $queryDirectory = Join-Path ([IO.Path]::GetFullPath($ResultDirectory)) 'query-count'
    [IO.Directory]::CreateDirectory($queryDirectory) | Out-Null

    $script:ComposeArguments = @('compose', '--env-file', $environmentFile, '-f', $composeFile)
    $health = (& docker inspect --format '{{.State.Health.Status}}' $env:PERF_POSTGRES_CONTAINER 2>$null)
    if ($LASTEXITCODE -ne 0 -or $health.Trim() -ne 'healthy') { throw 'Performance PostgreSQL is not healthy.' }
    Assert-NoConcurrentMeasurement

    & docker @script:ComposeArguments exec -T postgres psql --username $env:POSTGRES_USER --dbname $env:POSTGRES_DB --set ON_ERROR_STOP=1 --file '/performance/sql/50_enable_pg_stat_statements.sql' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to enable pg_stat_statements in the performance database.' }

    $studentToken = Invoke-Login $StudentEmail
    $companyToken = Invoke-Login $CompanyEmail

$endpoints = @(
    [ordered]@{ name = 'jobs-list'; path = '/api/jobs?page=1&size=20'; token = $studentToken; role = 'STUDENT' },
    [ordered]@{ name = 'company-applications'; path = '/api/companies/me/applications?page=1&size=20&sort=appliedAt%2Cdesc'; token = $companyToken; role = 'COMPANY' },
    [ordered]@{ name = 'public-companies'; path = '/api/public/companies?page=1&size=20&sort=createdAt%2Cdesc'; token = $null; role = 'none' }
)

$statsSql = @"
WITH captured AS (
    SELECT
        queryid::text AS query_id,
        regexp_replace(query, E'[\\n\\r\\t]+', ' ', 'g') AS normalized_sql,
        calls::bigint AS calls,
        rows::bigint AS rows,
        round(total_exec_time::numeric, 3) AS total_execution_ms,
        round(mean_exec_time::numeric, 3) AS mean_execution_ms,
        shared_blks_hit::bigint AS shared_block_hits,
        shared_blks_read::bigint AS shared_block_reads,
        CASE
            WHEN query ~* '^[[:space:]]*(begin|commit|rollback)'
                THEN 'transaction_control'
            WHEN query ~* 'from users [a-zA-Z0-9_]+ where [a-zA-Z0-9_]+[.]email[[:space:]]*=[[:space:]]*[$][0-9]+'
                THEN 'jwt_user_lookup'
            ELSE 'service'
        END AS statement_class
    FROM pg_stat_statements
    WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND query NOT ILIKE '%pg_stat_statements%'
      AND query NOT ILIKE '%pg_stat_activity%'
)
SELECT jsonb_build_object(
    'summary', jsonb_build_object(
        'totalSqlStatements', coalesce(sum(calls), 0),
        'uniqueNormalizedStatements', count(*),
        'jwtUserLookupStatements', coalesce(sum(calls) FILTER (WHERE statement_class = 'jwt_user_lookup'), 0),
        'transactionControlStatements', coalesce(sum(calls) FILTER (WHERE statement_class = 'transaction_control'), 0),
        'serviceStatements', coalesce(sum(calls) FILTER (WHERE statement_class = 'service'), 0),
        'totalRows', coalesce(sum(rows), 0),
        'totalExecutionMs', coalesce(round(sum(total_execution_ms), 3), 0),
        'sharedBlockHits', coalesce(sum(shared_block_hits), 0),
        'sharedBlockReads', coalesce(sum(shared_block_reads), 0)
    ),
    'statements', coalesce(jsonb_agg(to_jsonb(captured) ORDER BY total_execution_ms DESC), '[]'::jsonb)
)::text
FROM captured;
"@

    foreach ($endpoint in $endpoints) {
        Assert-NoConcurrentMeasurement
        Invoke-PsqlCommand 'SELECT pg_stat_statements_reset();' | Out-Null
        Assert-NoConcurrentMeasurement

        $headers = @{ Accept = 'application/json' }
        if ($null -ne $endpoint.token) { $headers.Authorization = "Bearer $($endpoint.token)" }
        $startedAt = (Get-Date).ToUniversalTime()
        $response = Invoke-WebRequest -Method Get -Uri "$($BaseUrl.TrimEnd('/'))$($endpoint.path)" -Headers $headers -UseBasicParsing
        $body = Test-PagedResponse $response $endpoint.name
        $completedAt = (Get-Date).ToUniversalTime()
        Assert-NoConcurrentMeasurement

        $stats = (Invoke-PsqlCommand $statsSql) | ConvertFrom-Json
        if ($stats.summary.totalSqlStatements -lt 1) { throw "No SQL statements captured for $($endpoint.name)." }

        $evidence = [ordered]@{
            phase = 'B1 query-count validation; not a latency baseline'
            endpoint = $endpoint.name
            request = "GET $($endpoint.path.Replace('%2C', ','))"
            authentication = $endpoint.role
            requestStartedUtc = $startedAt.ToString('o')
            requestCompletedUtc = $completedAt.ToString('o')
            http = [ordered]@{
                status = [int]$response.StatusCode
                responseBodyBytes = [Text.Encoding]::UTF8.GetByteCount($response.Content)
                pageItems = @($body.data.items).Count
            }
            queryStatistics = $stats.summary
            statements = $stats.statements
        }

        $timestamp = $startedAt.ToString('yyyyMMdd-HHmmssfff')
        $jsonPath = Join-Path $queryDirectory "$timestamp-$($endpoint.name).json"
        $evidence | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $jsonPath -Encoding utf8
        Write-Host ("{0}: total SQL={1}, JWT lookup={2}, transaction control={3}, service SQL={4}" -f $endpoint.name, $stats.summary.totalSqlStatements, $stats.summary.jwtUserLookupStatements, $stats.summary.transactionControlStatements, $stats.summary.serviceStatements)
    }

    Write-Host "Isolated query-count evidence written to $queryDirectory"
}
finally {
    $studentToken = $null
    $companyToken = $null
    if ($null -ne $measurementLease) {
        Exit-PerformanceMeasurementLock -Lease $measurementLease
    }
}
