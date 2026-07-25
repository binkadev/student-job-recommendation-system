[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ResultDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-MetricValues($Summary, [string]$MetricName) {
    $property = $Summary.metrics.PSObject.Properties | Where-Object Name -eq $MetricName | Select-Object -First 1
    if ($null -eq $property) { throw "Missing k6 metric '$MetricName'." }
    return $property.Value.values
}

function Get-Median([double[]]$Values) {
    if ($Values.Count -eq 0) { return $null }
    $sorted = @($Values | Sort-Object)
    $middle = [int][Math]::Floor($sorted.Count / 2)
    if ($sorted.Count % 2 -eq 1) { return [double]$sorted[$middle] }
    return ([double]$sorted[$middle - 1] + [double]$sorted[$middle]) / 2
}

function Format-Number($Value, [string]$Suffix = '') {
    if ($null -eq $Value) { return 'n/a' }
    return ('{0:0.###}{1}' -f [double]$Value, $Suffix)
}

$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not [IO.Path]::IsPathRooted($ResultDirectory)) {
    $ResultDirectory = Join-Path $repositoryRoot $ResultDirectory
}
$ResultDirectory = [IO.Path]::GetFullPath($ResultDirectory)
if (-not (Test-Path -LiteralPath $ResultDirectory -PathType Container)) {
    throw "Result directory does not exist: $ResultDirectory"
}
$relativeResultDirectory = $ResultDirectory.Substring($repositoryRoot.Length).TrimStart('\', '/').Replace('\', '/')

$endpointDefinitions = @(
    [ordered]@{
        name = 'jobs-list'
        request = 'GET /api/jobs?page=1&size=20'
        before = [ordered]@{ sqlCalls = 66; serviceSqlCalls = 63; sqlScope = 'HTTP'; p50Ms = 71.7433; p95Ms = 81.305875; p99Ms = 88.773907; throughputPerSecond = 117.73193731746802 }
        beforeShape = 'JWT lookup + pageable job content/count + per-item job-skill, skill, and company fan-out'
        afterShape = 'JWT lookup + pageable content with company + count + one batched job-skill/skill query'
    },
    [ordered]@{
        name = 'company-applications'
        request = 'GET /api/companies/me/applications?page=1&size=20&sort=appliedAt,desc'
        before = [ordered]@{ sqlCalls = 53; serviceSqlCalls = 50; sqlScope = 'HTTP V12 baseline'; p50Ms = 53.88745; p95Ms = 63.21743999999998; p99Ms = 70.22372; throughputPerSecond = 160.2860518737853 }
        beforeShape = 'Historical V12 HTTP capture with application mapping fan-out'
        afterShape = 'JWT lookup + company ownership lookup + pageable EntityGraph content + count'
    },
    [ordered]@{
        name = 'public-companies'
        request = 'GET /api/public/companies?page=1&size=20&sort=createdAt,desc'
        before = [ordered]@{ sqlCalls = 4; serviceSqlCalls = 3; sqlScope = 'HTTP'; p50Ms = 7.060499999999999; p95Ms = 8.6116; p99Ms = 9.596142; throughputPerSecond = 700.343657932604 }
        beforeShape = 'Public pageable company content/count + grouped open-job counts'
        afterShape = 'Unchanged public pageable company content/count + grouped open-job counts'
    },
    [ordered]@{
        name = 'saved-jobs'
        request = 'GET /api/students/me/saved-jobs?page=1&size=20'
        before = [ordered]@{ sqlCalls = $null; serviceSqlCalls = 27; sqlScope = 'integration-test service evidence'; p50Ms = $null; p95Ms = $null; p99Ms = $null; throughputPerSecond = $null }
        beforeShape = 'Student lookup + pageable content/count + lazy job/company fan-out'
        afterShape = 'JWT lookup + student lookup + pageable EntityGraph content with job/company + count'
    },
    [ordered]@{
        name = 'recommendation-runs'
        request = 'GET /api/students/me/recommendation-runs'
        before = [ordered]@{ sqlCalls = $null; serviceSqlCalls = 22; sqlScope = 'N + 2 service formula at N=20'; p50Ms = $null; p95Ms = $null; p99Ms = $null; throughputPerSecond = $null }
        beforeShape = 'Student lookup + run list + one COUNT per run (N + 2)'
        afterShape = 'JWT lookup + student lookup + ordered run list + one grouped result-count aggregate'
    }
)

$runDirectories = @(Get-ChildItem -LiteralPath $ResultDirectory -Directory -Filter 'run-*' | Sort-Object Name)
if ($runDirectories.Count -ne 3) {
    throw "Expected exactly 3 independent run directories, found $($runDirectories.Count)."
}

$queryCountDirectory = Join-Path $ResultDirectory 'query-count'
$endpointResults = @()
foreach ($definition in $endpointDefinitions) {
    $runs = @()
    foreach ($runDirectory in $runDirectories) {
        $endpointDirectory = Join-Path (Join-Path $runDirectory.FullName 'k6') $definition.name
        $summaryPath = Join-Path $endpointDirectory 'summary.json'
        $rawSummaryPath = Join-Path $endpointDirectory 'raw-summary.json'
        $statisticsPath = Join-Path $endpointDirectory 'pg-stat-statements.json'
        foreach ($requiredPath in @($summaryPath, $rawSummaryPath, $statisticsPath)) {
            if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) { throw "Missing evidence: $requiredPath" }
        }

        $summary = Get-Content -LiteralPath $summaryPath -Raw | ConvertFrom-Json
        $statistics = Get-Content -LiteralPath $statisticsPath -Raw | ConvertFrom-Json
        $duration = Get-MetricValues $summary 'http_req_duration{measured:true}'
        $requests = Get-MetricValues $summary 'http_reqs{measured:true}'
        $failedRequests = Get-MetricValues $summary 'http_req_failed{measured:true}'
        $checks = Get-MetricValues $summary 'checks{measured:true}'
        $dropped = Get-MetricValues $summary 'dropped_iterations'
        $bytes = Get-MetricValues $summary 'response_body_bytes'
        $runs += [ordered]@{
            run = $runDirectory.Name
            measuredRequests = [int64]$requests.count
            p50Ms = [double]$duration.'p(50)'
            p95Ms = [double]$duration.'p(95)'
            p99Ms = [double]$duration.'p(99)'
            throughputPerSecond = [double]$requests.rate
            httpFailureRate = [double]$failedRequests.rate
            failedChecks = [int64]$checks.fails
            droppedIterations = [int64]$dropped.count
            responseBodyBytesAverage = [double]$bytes.avg
            sqlCallsPerRequest = [double]$statistics.sqlCallsPerRequest
            serviceSqlCallsPerRequest = [double]$statistics.serviceSqlCallsPerRequest
        }
    }

    $isolatedEvidenceFile = Get-ChildItem -LiteralPath $queryCountDirectory -Filter "*-$($definition.name).json" |
        Sort-Object Name |
        Select-Object -Last 1
    if ($null -eq $isolatedEvidenceFile) { throw "Missing isolated query-count evidence for $($definition.name)." }
    $isolated = Get-Content -LiteralPath $isolatedEvidenceFile.FullName -Raw | ConvertFrom-Json

    $after = [ordered]@{
        p50Ms = Get-Median @($runs | ForEach-Object { [double]$_.p50Ms })
        p95Ms = Get-Median @($runs | ForEach-Object { [double]$_.p95Ms })
        p99Ms = Get-Median @($runs | ForEach-Object { [double]$_.p99Ms })
        throughputPerSecond = Get-Median @($runs | ForEach-Object { [double]$_.throughputPerSecond })
        httpFailureRate = Get-Median @($runs | ForEach-Object { [double]$_.httpFailureRate })
        failedChecks = [int64](($runs | ForEach-Object { $_.failedChecks } | Measure-Object -Sum).Sum)
        droppedIterations = [int64](($runs | ForEach-Object { $_.droppedIterations } | Measure-Object -Sum).Sum)
        responseBodyBytesAverage = Get-Median @($runs | ForEach-Object { [double]$_.responseBodyBytesAverage })
        sqlCallsPerRequest = [double]$isolated.queryStatistics.totalSqlStatements
        jwtUserLookupCallsPerRequest = [double]$isolated.queryStatistics.jwtUserLookupStatements
        transactionControlCallsPerRequest = [double]$isolated.queryStatistics.transactionControlStatements
        serviceSqlCallsPerRequest = [double]$isolated.queryStatistics.serviceStatements
        loadSqlCallsPerRequestMedian = Get-Median @($runs | ForEach-Object { [double]$_.sqlCallsPerRequest })
    }

    $endpointResults += [ordered]@{
        endpoint = $definition.name
        request = $definition.request
        before = $definition.before
        after = $after
        beforeQueryShape = $definition.beforeShape
        afterQueryShape = $definition.afterShape
        runs = $runs
        isolatedQueryCountEvidence = $isolatedEvidenceFile.Name
    }
}

$metadata = Get-Content -LiteralPath (Join-Path $ResultDirectory 'metadata.json') -Raw | ConvertFrom-Json
$explainPlanSummaries = @(
    Get-ChildItem -LiteralPath (Join-Path $ResultDirectory 'explain') -Filter '*.json' |
        Where-Object Name -notlike '*manifest*' |
        Sort-Object Name |
        ForEach-Object {
            $planDocument = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
            $plan = $planDocument[0]
            [ordered]@{
                file = $_.Name
                rootNode = $plan.Plan.'Node Type'
                actualRows = [int64]$plan.Plan.'Actual Rows'
                planningMs = [double]$plan.'Planning Time'
                executionMs = [double]$plan.'Execution Time'
                sharedBlockHits = [int64]$plan.Plan.'Shared Hit Blocks'
                sharedBlockReads = [int64]$plan.Plan.'Shared Read Blocks'
            }
        }
)
$machineSummary = [ordered]@{
    phase = 'optimized branch HTTP end-to-end remeasurement'
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    resultDirectory = $relativeResultDirectory
    git = $metadata.git
    environment = [ordered]@{
        runtime = $metadata.runtime
        host = $metadata.host
        database = $metadata.database
    }
    methodology = [ordered]@{
        independentRuns = 3
        virtualUsers = 10
        iterationsPerEndpointPerRun = 10000
        warmup = '1 VU x 20 iterations per endpoint before each measured run'
        pgStatStatementsReset = 'after warm-up and immediately before measured requests'
    }
    endpoints = $endpointResults
    explainPlans = $explainPlanSummaries
}
$machineSummary | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $ResultDirectory 'summary.json') -Encoding utf8

$comparisonRows = foreach ($result in $endpointResults) {
    $beforeSql = if ($null -eq $result.before.sqlCalls) { 'n/a' } else { [string]$result.before.sqlCalls }
    "| ``$($result.request)`` | $beforeSql ($($result.before.sqlScope)) | $($result.after.sqlCallsPerRequest) | $(Format-Number $result.before.p50Ms ' ms') | $(Format-Number $result.after.p50Ms ' ms') | $(Format-Number $result.before.p95Ms ' ms') | $(Format-Number $result.after.p95Ms ' ms') | $(Format-Number $result.before.p99Ms ' ms') | $(Format-Number $result.after.p99Ms ' ms') | $(Format-Number $result.before.throughputPerSecond ' req/s') | $(Format-Number $result.after.throughputPerSecond ' req/s') |"
}

$runRows = foreach ($result in $endpointResults) {
    foreach ($run in $result.runs) {
        "| $($result.endpoint) | $($run.run) | $($run.measuredRequests) | $(Format-Number $run.p50Ms) | $(Format-Number $run.p95Ms) | $(Format-Number $run.p99Ms) | $(Format-Number $run.throughputPerSecond) | $($run.httpFailureRate) | $($run.failedChecks) | $($run.droppedIterations) | $(Format-Number $run.sqlCallsPerRequest) |"
    }
}

$shapeSections = foreach ($result in $endpointResults) {
    @"
### $($result.endpoint)

- Before: $($result.beforeQueryShape).
- After: $($result.afterQueryShape).
- Isolated HTTP SQL: total ``$($result.after.sqlCallsPerRequest)``, JWT/security ``$($result.after.jwtUserLookupCallsPerRequest)``, transaction control ``$($result.after.transactionControlCallsPerRequest)``, service ``$($result.after.serviceSqlCallsPerRequest)``.
"@
}

$planRows = foreach ($plan in $explainPlanSummaries) {
    "| $($plan.file) | $($plan.rootNode) | $($plan.actualRows) | $(Format-Number $plan.planningMs) | $(Format-Number $plan.executionMs) | $($plan.sharedBlockHits) | $($plan.sharedBlockReads) |"
}

$markdown = @"
# Optimized HTTP Performance Remeasurement

- Git SHA: ``$($metadata.git.sha)``
- Branch: ``$($metadata.git.branch)``
- Dataset: 1,000 students; 100 companies; 10,000 jobs; 50,000 applications; 20,000 saved jobs; 20 recommendation runs; 40 recommendation results
- Load: 3 independent runs, 10 VUs, 10,000 measured requests per endpoint and run
- Warm-up: 1 VU × 20 requests per endpoint before each measured phase
- SQL isolation: ``pg_stat_statements_reset()`` after warm-up and immediately before measured requests
- Correctness: all after values below come from captured evidence; no baseline evidence was overwritten

## Before/after

| Endpoint | SQL before | HTTP SQL after | p50 before | p50 after | p95 before | p95 after | p99 before | p99 after | throughput before | throughput after |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
$($comparisonRows -join "`n")

Saved-jobs before SQL is service-level integration evidence (20 items = 27 statements), not an old HTTP capture. Recommendation-runs before is the service formula ``N + 2`` (22 statements at 20 runs). The Company-applications V12 baseline recorded 53 HTTP SQL calls, but its EntityGraph predated this performance branch, so the current reduction is not attributed solely to this branch.

## Three independent measured runs

| Endpoint | Run | Requests | p50 ms | p95 ms | p99 ms | req/s | HTTP failure rate | Failed checks | Dropped | Load SQL/request |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
$($runRows -join "`n")

## Query shapes

$($shapeSections -join "`n")

## EXPLAIN summary

| Plan | Root node | Rows | Planning ms | Execution ms | Shared hits | Shared reads |
|---|---|---:|---:|---:|---:|---:|
$($planRows -join "`n")

## Evidence

- Raw k6 summaries and normalized summaries: ``run-*/k6/<endpoint>/raw-summary.json`` and ``summary.json``
- Per-run top PostgreSQL statements: ``run-*/k6/<endpoint>/pg-stat-statements.json``
- Isolated one-request SQL classification: ``query-count/*.json``
- ``EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)``: ``explain/*.json``
- Environment and dataset manifest: ``metadata.json``, ``metadata.md``, ``benchmark-manifest.json``
- Machine-readable consolidated result: ``summary.json``
"@
$markdown | Set-Content -LiteralPath (Join-Path $ResultDirectory 'summary.md') -Encoding utf8
Write-Host "Optimized benchmark summaries written to $ResultDirectory"
