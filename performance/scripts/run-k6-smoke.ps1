[CmdletBinding()]
param(
    [string]$BaseUrl = $(if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost:8080' }),
    [string]$ResultDirectory = $env:RESULT_DIRECTORY,
    [string]$PerformancePassword = $env:PERFORMANCE_PASSWORD,
    [switch]$ForceDocker
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib/k6-runner.ps1')

$runDirectory = New-PerformanceRunDirectory -RequestedPath $ResultDirectory
Assert-K6Inputs -BaseUrl $BaseUrl -Vus 1 -Iterations 5 -PerformancePassword $PerformancePassword

& (Join-Path $PSScriptRoot 'collect-environment-metadata.ps1') -ResultDirectory $runDirectory -BaseUrl $BaseUrl
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
        -Vus 1 `
        -Iterations 5 `
        -PerformancePassword $PerformancePassword `
        -WorkloadKind smoke `
        -ForceDocker:$ForceDocker
}

Write-Host 'Phase B1 smoke validation passed: 1 VU, 5 iterations per endpoint.'
Write-Host "Result directory: $runDirectory"

