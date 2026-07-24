[CmdletBinding()]
param(
    [string]$BaseUrl = $(if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost:8080' }),
    [int]$Vus = $(if ($env:VUS) { [int]$env:VUS } else { 10 }),
    [int]$Iterations = $(if ($env:ITERATIONS) { [int]$env:ITERATIONS } else { 10000 }),
    [string]$ResultDirectory = $env:RESULT_DIRECTORY,
    [string]$PerformancePassword = $env:PERFORMANCE_PASSWORD,
    [switch]$ForceDocker
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib/k6-runner.ps1')
. (Join-Path $PSScriptRoot 'lib/measurement-lock.ps1')

Assert-K6Inputs -BaseUrl $BaseUrl -Vus $Vus -Iterations $Iterations -PerformancePassword $PerformancePassword
$performanceRoot = Split-Path -Parent $PSScriptRoot
$measurementLease = $null

try {
    $measurementLease = Enter-PerformanceMeasurementLock -PerformanceRoot $performanceRoot -LockKind 'load-test' -WorkloadType 'k6-baseline'
    Assert-NoExternalK6Workload
    $k6Runtime = Resolve-K6Runtime -ForceDocker:$ForceDocker
    $runDirectory = New-PerformanceRunDirectory -RequestedPath $ResultDirectory

    Write-Warning "This is the final baseline launcher: $Vus VUs and $Iterations iterations PER ENDPOINT."
    & (Join-Path $PSScriptRoot 'collect-environment-metadata.ps1') `
        -ResultDirectory $runDirectory `
        -BaseUrl $BaseUrl `
        -K6RunnerKind $k6Runtime.Kind `
        -K6VersionOutput $k6Runtime.FullVersion `
        -K6DockerImage ([string]$k6Runtime.DockerImage)
    if ($LASTEXITCODE -ne 0) { throw 'Environment metadata collection failed.' }

    foreach ($workload in @(
        @{ Script = 'jobs-list.js'; Endpoint = 'jobs-list' },
        @{ Script = 'company-applications.js'; Endpoint = 'company-applications' },
        @{ Script = 'public-companies.js'; Endpoint = 'public-companies' }
    )) {
        Invoke-K6Endpoint `
            -ScriptName $workload.Script `
            -EndpointName $workload.Endpoint `
            -RunDirectory $runDirectory `
            -BaseUrl $BaseUrl `
            -Vus $Vus `
            -Iterations $Iterations `
            -PerformancePassword $PerformancePassword `
            -WorkloadKind baseline `
            -K6Runtime $k6Runtime
    }

    Write-Host "Baseline workload complete. Result directory: $runDirectory"
}
finally {
    if ($null -ne $measurementLease) {
        Exit-PerformanceMeasurementLock -Lease $measurementLease
    }
}

