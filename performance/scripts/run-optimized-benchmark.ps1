[CmdletBinding()]
param(
    [string]$BaseUrl = $(if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost:8080' }),
    [int]$Vus = $(if ($env:VUS) { [int]$env:VUS } else { 10 }),
    [int]$Iterations = $(if ($env:ITERATIONS) { [int]$env:ITERATIONS } else { 10000 }),
    [int]$IndependentRuns = 3,
    [int]$WarmupIterations = 20,
    [string]$ResultDirectory = $env:RESULT_DIRECTORY,
    [string]$PerformancePassword = $env:PERFORMANCE_PASSWORD,
    [switch]$ForceDocker
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib/k6-runner.ps1')
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
        if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { throw "Invalid environment key in $Path." }
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

function Assert-PerformanceIdentity {
    if ($env:POSTGRES_DB -ne 'student_job_recommendation_perf') { throw 'Refusing benchmark: unexpected POSTGRES_DB.' }
    if ($env:POSTGRES_USER -ne 'perf_user') { throw 'Refusing benchmark: unexpected POSTGRES_USER.' }
    if ($env:POSTGRES_PORT -ne '55432') { throw 'Refusing benchmark: unexpected POSTGRES_PORT.' }
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

function Invoke-BenchmarkLogin([string]$Email) {
    $body = @{ email = $Email; password = $PerformancePassword } | ConvertTo-Json -Compress
    $response = Invoke-WebRequest `
        -Method Post `
        -Uri "$($BaseUrl.TrimEnd('/'))/api/auth/login" `
        -ContentType 'application/json' `
        -Body $body `
        -UseBasicParsing
    $json = $response.Content | ConvertFrom-Json
    if ($response.StatusCode -ne 200 -or $json.success -ne $true -or [string]::IsNullOrWhiteSpace($json.data.token)) {
        throw "Authentication setup failed for $Email (HTTP $($response.StatusCode))."
    }
    return [string]$json.data.token
}

function Write-JsonFile([string]$Path, $Value) {
    $Value | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding utf8
}

Assert-K6Inputs -BaseUrl $BaseUrl -Vus $Vus -Iterations $Iterations -PerformancePassword $PerformancePassword
if ($IndependentRuns -lt 1) { throw 'IndependentRuns must be a positive integer.' }
if ($WarmupIterations -lt 1) { throw 'WarmupIterations must be a positive integer.' }

$performanceRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $performanceRoot
$environmentFile = Join-Path $performanceRoot '.env'
$composeFile = Join-Path $performanceRoot 'docker-compose.yml'
Import-PerformanceEnvironment $environmentFile
Assert-PerformanceIdentity

if ([string]::IsNullOrWhiteSpace($ResultDirectory)) {
    $safeRepository = $repositoryRoot.Replace('\', '/')
    $shortSha = (& git -c "safe.directory=$safeRepository" -C $repositoryRoot rev-parse --short=8 HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Unable to resolve Git SHA.' }
    $ResultDirectory = Join-Path $performanceRoot "results/optimized/$(Get-Date -Format 'yyyyMMdd-HHmmss')-$shortSha"
}
$runRoot = New-PerformanceRunDirectory -RequestedPath $ResultDirectory
$relativeRunRoot = $runRoot.Substring($repositoryRoot.Length).TrimStart('\', '/').Replace('\', '/')
$script:ComposeArguments = @('compose', '--env-file', $environmentFile, '-f', $composeFile)

$statisticsSql = @"
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

$measurementLease = $null
$studentToken = $null
$companyToken = $null
try {
    $measurementLease = Enter-PerformanceMeasurementLock `
        -PerformanceRoot $performanceRoot `
        -LockKind 'load-test' `
        -WorkloadType 'optimized-http-remeasurement'
    Assert-NoExternalK6Workload

    $health = (& docker inspect --format '{{.State.Health.Status}}' $env:PERF_POSTGRES_CONTAINER 2>$null)
    if ($LASTEXITCODE -ne 0 -or $health.Trim() -ne 'healthy') { throw 'Performance PostgreSQL is not healthy.' }

    & docker @script:ComposeArguments exec -T postgres psql `
        --username $env:POSTGRES_USER `
        --dbname $env:POSTGRES_DB `
        --set ON_ERROR_STOP=1 `
        --file '/performance/sql/50_enable_pg_stat_statements.sql' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to enable pg_stat_statements.' }

    $k6Runtime = Resolve-K6Runtime -ForceDocker:$ForceDocker
    $studentToken = Invoke-BenchmarkLogin 'perf.student.0001@example.test'
    $companyToken = Invoke-BenchmarkLogin 'perf.company.001@example.test'

    & (Join-Path $PSScriptRoot 'collect-environment-metadata.ps1') `
        -ResultDirectory $runRoot `
        -BaseUrl $BaseUrl `
        -K6RunnerKind $k6Runtime.Kind `
        -K6VersionOutput $k6Runtime.FullVersion `
        -K6DockerImage ([string]$k6Runtime.DockerImage)
    if ($LASTEXITCODE -ne 0) { throw 'Environment metadata collection failed.' }

    $workloads = @(
        [ordered]@{ script = 'jobs-list.js'; endpoint = 'jobs-list'; token = $studentToken },
        [ordered]@{ script = 'company-applications.js'; endpoint = 'company-applications'; token = $companyToken },
        [ordered]@{ script = 'public-companies.js'; endpoint = 'public-companies'; token = $null },
        [ordered]@{ script = 'saved-jobs.js'; endpoint = 'saved-jobs'; token = $studentToken },
        [ordered]@{ script = 'recommendation-runs.js'; endpoint = 'recommendation-runs'; token = $studentToken }
    )

    $benchmarkManifest = [ordered]@{
        phase = 'optimized branch HTTP end-to-end remeasurement'
        startedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
        resultDirectory = $relativeRunRoot
        virtualUsers = $Vus
        iterationsPerEndpoint = $Iterations
        independentRuns = $IndependentRuns
        warmup = [ordered]@{
            virtualUsers = 1
            iterationsPerEndpoint = $WarmupIterations
            tokenProvisionedBeforeStatisticsReset = $true
        }
        statisticsReset = 'after each endpoint warm-up and immediately before its measured k6 process'
        workloads = @($workloads | ForEach-Object { [ordered]@{ script = $_.script; endpoint = $_.endpoint } })
        runs = @()
    }

    for ($runNumber = 1; $runNumber -le $IndependentRuns; $runNumber++) {
        $runName = 'run-{0:D2}' -f $runNumber
        $independentRunDirectory = Join-Path $runRoot $runName
        [IO.Directory]::CreateDirectory($independentRunDirectory) | Out-Null
        $runEvidence = [ordered]@{
            run = $runNumber
            startedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
            endpoints = @()
        }

        foreach ($workload in $workloads) {
            Write-Host "[$runName] Warming up $($workload.endpoint) with 1 VU / $WarmupIterations iterations."
            Invoke-K6Endpoint `
                -ScriptName $workload.script `
                -EndpointName $workload.endpoint `
                -RunDirectory $independentRunDirectory `
                -BaseUrl $BaseUrl `
                -Vus 1 `
                -Iterations $WarmupIterations `
                -PerformancePassword $PerformancePassword `
                -WorkloadKind smoke `
                -K6Runtime $k6Runtime `
                -AuthToken $workload.token

            Invoke-PsqlCommand 'SELECT pg_stat_statements_reset();' | Out-Null
            $measuredStartedAt = (Get-Date).ToUniversalTime()
            Write-Host "[$runName] Measuring $($workload.endpoint) with $Vus VUs / $Iterations iterations."
            Invoke-K6Endpoint `
                -ScriptName $workload.script `
                -EndpointName $workload.endpoint `
                -RunDirectory $independentRunDirectory `
                -BaseUrl $BaseUrl `
                -Vus $Vus `
                -Iterations $Iterations `
                -PerformancePassword $PerformancePassword `
                -WorkloadKind baseline `
                -K6Runtime $k6Runtime `
                -AuthToken $workload.token
            $measuredCompletedAt = (Get-Date).ToUniversalTime()

            $statistics = (Invoke-PsqlCommand $statisticsSql) | ConvertFrom-Json
            if ([int64]$statistics.summary.totalSqlStatements -lt 1) {
                throw "No SQL statements captured for $($workload.endpoint)."
            }
            $statisticsEvidence = [ordered]@{
                endpoint = $workload.endpoint
                measuredRequests = $Iterations
                resetImmediatelyBeforeMeasuredPhase = $true
                measuredStartedAtUtc = $measuredStartedAt.ToString('o')
                measuredCompletedAtUtc = $measuredCompletedAt.ToString('o')
                sqlCallsPerRequest = [double]$statistics.summary.totalSqlStatements / $Iterations
                jwtUserLookupCallsPerRequest = [double]$statistics.summary.jwtUserLookupStatements / $Iterations
                transactionControlCallsPerRequest = [double]$statistics.summary.transactionControlStatements / $Iterations
                serviceSqlCallsPerRequest = [double]$statistics.summary.serviceStatements / $Iterations
                queryStatistics = $statistics.summary
                statements = $statistics.statements
            }
            $endpointDirectory = Join-Path (Join-Path $independentRunDirectory 'k6') $workload.endpoint
            Write-JsonFile `
                -Path (Join-Path $endpointDirectory 'pg-stat-statements.json') `
                -Value $statisticsEvidence
            $runEvidence.endpoints += [ordered]@{
                endpoint = $workload.endpoint
                measuredStartedAtUtc = $measuredStartedAt.ToString('o')
                measuredCompletedAtUtc = $measuredCompletedAt.ToString('o')
                sqlCallsPerRequest = $statisticsEvidence.sqlCallsPerRequest
                serviceSqlCallsPerRequest = $statisticsEvidence.serviceSqlCallsPerRequest
            }
        }

        $runEvidence.completedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
        Write-JsonFile -Path (Join-Path $independentRunDirectory 'run-manifest.json') -Value $runEvidence
        $benchmarkManifest.runs += $runEvidence
    }

    $benchmarkManifest.completedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    Write-JsonFile -Path (Join-Path $runRoot 'benchmark-manifest.json') -Value $benchmarkManifest
    Write-Host "Optimized benchmark complete. Result directory: $runRoot"
}
finally {
    $studentToken = $null
    $companyToken = $null
    if ($null -ne $measurementLease) {
        Exit-PerformanceMeasurementLock -Lease $measurementLease
    }
}
